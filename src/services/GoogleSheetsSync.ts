import type { GameSession } from '../store/useGameStore';
import { loadPersonalSheetsToken } from './PersonalSheetsConfig';

const QUEUE_STORAGE_KEY = 'typing-sheets-sync-queue-v1';
const STATUS_EVENT = 'typing-sheets-sync-status';
const SCHEMA_VERSION = 1;

export type SheetSyncPhase = 'disabled' | 'idle' | 'syncing' | 'synced' | 'error';

export interface SheetSyncStatus {
    phase: SheetSyncPhase;
    pendingCount: number;
    message?: string;
}

interface QueueEntry {
    session: GameSession;
    personalToken?: string;
    attempts: number;
    lastAttemptAt?: string;
    lastError?: string;
}

interface SyncOptions {
    endpoint?: string;
    fetcher?: typeof fetch;
    maxAttempts?: number;
    retryDelayMs?: number;
    visitorResolver?: () => Promise<VisitorContext>;
}

export interface VisitorContext {
    countryCode: string;
    ip: string;
}

let activeSync: Promise<SheetSyncStatus> | null = null;

const getEndpoint = () => import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL?.trim() ?? '';

const emitStatus = (status: SheetSyncStatus) => {
    window.dispatchEvent(new CustomEvent<SheetSyncStatus>(STATUS_EVENT, { detail: status }));
    return status;
};

const readQueue = (): QueueEntry[] => {
    try {
        const value = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) ?? '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
};

const writeQueue = (queue: QueueEntry[]) => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-200)));
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
});

let cachedVisitorContext: VisitorContext | null = null;

export const resolveVisitorContext = async (): Promise<VisitorContext> => {
    if (cachedVisitorContext) return cachedVisitorContext;
    let timeout = 0;
    try {
        const controller = new AbortController();
        timeout = window.setTimeout(() => controller.abort(), 2_000);
        const response = await fetch('https://api.country.is/', { signal: controller.signal });
        if (!response.ok) throw new Error(`Country lookup failed: HTTP ${response.status}`);
        const result = await response.json() as { country?: string; ip?: string };
        const countryCode = /^[A-Z]{2}$/.test(result.country ?? '') ? result.country! : '';
        const ip = /^[0-9a-fA-F:.]{3,64}$/.test(result.ip ?? '') ? result.ip! : '';
        cachedVisitorContext = { countryCode, ip };
        return cachedVisitorContext;
    } catch {
        return { countryCode: '', ip: '' };
    } finally {
        if (timeout) window.clearTimeout(timeout);
    }
};

const averageByKey = (values: Record<string, number[]>) => Object.fromEntries(
    Object.entries(values).map(([key, latencies]) => [
        key,
        latencies.length > 0
            ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
            : 0,
    ]),
);

export const toSheetPayload = (session: GameSession) => ({
    schemaVersion: SCHEMA_VERSION,
    sessionId: session.id,
    startedAt: new Date(session.timestamp - session.duration * 1_000).toISOString(),
    completedAt: new Date(session.timestamp).toISOString(),
    clientTimezoneOffsetMinutes: new Date(session.timestamp).getTimezoneOffset(),
    mode: session.mode,
    score: session.score,
    errors: session.errors,
    totalKeystrokes: session.score + session.errors,
    accuracy: session.accuracy,
    ppm: session.ppm,
    avgLatencyMs: session.avgLatency,
    durationSeconds: session.duration,
    keyErrors: session.keyErrors,
    keyLatencyAverageMs: averageByKey(session.keyLatencies),
});

export const queueSessionForSheets = (session: GameSession, personalToken = loadPersonalSheetsToken()) => {
    const queue = readQueue();
    if (!queue.some((entry) => entry.session.id === session.id)) {
        queue.push({ session, personalToken: personalToken.trim() || undefined, attempts: 0 });
        writeQueue(queue);
    }
    return queue.length;
};

export const getPendingSheetsSessionIds = () => readQueue().map((entry) => entry.session.id);

export const getInitialSheetSyncStatus = (): SheetSyncStatus => ({
    phase: getEndpoint() ? 'idle' : 'disabled',
    pendingCount: readQueue().length,
});

const syncQueue = async ({
    endpoint = getEndpoint(),
    fetcher = fetch,
    maxAttempts = 3,
    retryDelayMs = 600,
    visitorResolver = resolveVisitorContext,
}: SyncOptions = {}): Promise<SheetSyncStatus> => {
    let queue = readQueue();
    if (!endpoint) {
        return emitStatus({
            phase: 'disabled',
            pendingCount: queue.length,
            message: '尚未設定 Google Apps Script Web App URL，資料已保留在本機。',
        });
    }
    if (queue.length === 0) {
        return emitStatus({ phase: 'synced', pendingCount: 0 });
    }

    emitStatus({ phase: 'syncing', pendingCount: queue.length });
    let lastError = '';

    for (const queued of [...queue]) {
        let uploaded = false;
        const visitor = await visitorResolver();
        for (let attempt = 1; attempt <= maxAttempts && !uploaded; attempt += 1) {
            try {
                const response = await fetcher(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        token: queued.personalToken ?? '',
                        visitor,
                        payload: toSheetPayload(queued.session),
                    }),
                    redirect: 'follow',
                });
                const result = await response.json() as { ok?: boolean; error?: string };
                if (!response.ok || result.ok !== true) {
                    throw new Error(result.error || `HTTP ${response.status}`);
                }
                queue = queue.filter((entry) => entry.session.id !== queued.session.id);
                writeQueue(queue);
                uploaded = true;
            } catch (error) {
                lastError = error instanceof Error ? error.message : '未知的同步錯誤';
                queue = queue.map((entry) => entry.session.id === queued.session.id
                    ? {
                        ...entry,
                        attempts: entry.attempts + 1,
                        lastAttemptAt: new Date().toISOString(),
                        lastError,
                    }
                    : entry);
                writeQueue(queue);
                if (attempt < maxAttempts) await wait(retryDelayMs * attempt);
            }
        }
    }

    return queue.length === 0
        ? emitStatus({ phase: 'synced', pendingCount: 0 })
        : emitStatus({ phase: 'error', pendingCount: queue.length, message: lastError });
};

export const syncPendingSheetsSessions = (options?: SyncOptions) => {
    if (!activeSync) {
        activeSync = syncQueue(options).finally(() => {
            activeSync = null;
        });
    }
    return activeSync;
};

export const subscribeToSheetSyncStatus = (listener: (status: SheetSyncStatus) => void) => {
    const handler = (event: Event) => listener((event as CustomEvent<SheetSyncStatus>).detail);
    window.addEventListener(STATUS_EVENT, handler);
    return () => window.removeEventListener(STATUS_EVENT, handler);
};
