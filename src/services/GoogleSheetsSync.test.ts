// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getPendingSheetsSessionIds,
    queueSessionForSheets,
    syncPendingSheetsSessions,
    toSheetPayload,
} from './GoogleSheetsSync';
import type { GameSession } from '../store/useGameStore';
import { isValidPersonalSheetsToken, savePersonalSheetsToken } from './PersonalSheetsConfig';

const session: GameSession = {
    id: 'session-id',
    timestamp: Date.parse('2026-08-24T09:00:00.000Z'),
    mode: 'English',
    score: 42,
    errors: 3,
    accuracy: 93,
    ppm: 84,
    avgLatency: 320,
    keyLatencies: { KeyA: [300, 340] },
    keyErrors: { KeyA: 2 },
    keyMistakes: {},
    keystrokeTimings: [],
    duration: 30,
};

describe('Google Sheets sync queue', () => {
    beforeEach(() => localStorage.clear());

    it('builds the aggregate v1 payload without raw keystrokes', () => {
        expect(toSheetPayload(session)).toMatchObject({
            schemaVersion: 1,
            sessionId: 'session-id',
            startedAt: '2026-08-24T08:59:30.000Z',
            completedAt: '2026-08-24T09:00:00.000Z',
            totalKeystrokes: 45,
            keyLatencyAverageMs: { KeyA: 320 },
        });
        expect(toSheetPayload(session)).not.toHaveProperty('keystrokeTimings');
    });

    it('deduplicates queued sessions and removes them after a successful upload', async () => {
        queueSessionForSheets(session);
        queueSessionForSheets(session);
        expect(getPendingSheetsSessionIds()).toEqual(['session-id']);

        const response = {
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
        } as unknown as Response;
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

        const result = await syncPendingSheetsSessions({
            endpoint: 'https://script.google.com/macros/s/example/exec',
            fetcher,
            retryDelayMs: 0,
            visitorResolver: async () => ({ countryCode: 'TW', ip: '203.0.113.7' }),
        });

        expect(result).toMatchObject({ phase: 'synced', pendingCount: 0 });
        expect(getPendingSheetsSessionIds()).toEqual([]);
        expect(fetcher).toHaveBeenCalledTimes(1);
        const request = fetcher.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(String(request.body))).toMatchObject({
            token: '',
            visitor: { countryCode: 'TW', ip: '203.0.113.7' },
            payload: { sessionId: 'session-id' },
        });
    });

    it('captures the private token with the queued session', async () => {
        savePersonalSheetsToken('a'.repeat(32));
        queueSessionForSheets(session);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
        } as Response);

        await syncPendingSheetsSessions({
            endpoint: 'https://script.google.com/macros/s/example/exec',
            fetcher,
            retryDelayMs: 0,
            visitorResolver: async () => ({ countryCode: '', ip: '' }),
        });

        const request = fetcher.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(String(request.body)).token).toBe('a'.repeat(32));
    });

    it('retries a transient error and preserves a failed session', async () => {
        queueSessionForSheets(session);
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

        const result = await syncPendingSheetsSessions({
            endpoint: 'https://script.google.com/macros/s/example/exec',
            fetcher,
            maxAttempts: 2,
            retryDelayMs: 0,
            visitorResolver: async () => ({ countryCode: '', ip: '' }),
        });

        expect(result).toMatchObject({ phase: 'error', pendingCount: 1, message: 'offline' });
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(getPendingSheetsSessionIds()).toEqual(['session-id']);
    });

    it('accepts an empty public token or a sufficiently long private token', () => {
        expect(isValidPersonalSheetsToken('')).toBe(true);
        expect(isValidPersonalSheetsToken('short')).toBe(false);
        expect(isValidPersonalSheetsToken('x'.repeat(24))).toBe(true);
    });
});
