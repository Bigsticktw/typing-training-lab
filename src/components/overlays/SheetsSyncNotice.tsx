import { useEffect, useState } from 'react';
import {
    getInitialSheetSyncStatus,
    queueSessionForSheets,
    subscribeToSheetSyncStatus,
    syncPendingSheetsSessions,
    type SheetSyncStatus,
} from '../../services/GoogleSheetsSync';
import type { GameSession } from '../../store/useGameStore';
import { loadPersonalSheetsToken } from '../../services/PersonalSheetsConfig';

interface SheetsSyncNoticeProps {
    session?: GameSession;
}

export const SheetsSyncNotice = ({ session }: SheetsSyncNoticeProps) => {
    const [status, setStatus] = useState<SheetSyncStatus>(getInitialSheetSyncStatus);
    const personalMode = Boolean(loadPersonalSheetsToken());

    useEffect(() => subscribeToSheetSyncStatus(setStatus), []);

    useEffect(() => {
        if (!session) return;
        queueSessionForSheets(session);
        void syncPendingSheetsSessions();
    }, [session]);

    if (!session || !personalMode) return null;

    const label = status.phase === 'syncing'
        ? `正在同步到你的私人 Google Sheet（${status.pendingCount} 筆）…`
        : status.phase === 'synced'
            ? '本次訓練已同步到你的私人 Google Sheet。'
            : status.phase === 'disabled'
                ? 'Google Sheets 尚未設定；本次訓練仍已保存在此裝置。'
                : status.phase === 'error'
                    ? `同步失敗，${status.pendingCount} 筆資料留在此裝置等待重試。`
                    : `有 ${status.pendingCount} 筆資料等待同步。`;

    return (
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm opacity-80" role="status">
            <span>{label}</span>
            {status.phase === 'error' && (
                <button
                    type="button"
                    onClick={() => void syncPendingSheetsSessions()}
                    className="rounded border border-[var(--text-secondary)] px-3 py-1 hover:opacity-100"
                >
                    重新同步
                </button>
            )}
        </div>
    );
};
