import { useMultiplayerStore } from '../../store/useMultiplayerStore';
import { Users, Check, X, LogOut } from 'lucide-react';
import clsx from 'clsx';

export function RoomView() {
    const {
        currentRoom,
        roomPlayers,
        playerId,
        setReady,
        leaveRoom,
    } = useMultiplayerStore();

    if (!currentRoom) return null;

    const myPlayer = roomPlayers.find(p => p.id === playerId);
    const isReady = myPlayer?.isReady ?? false;
    const allReady = roomPlayers.every(p => p.isReady);
    const canStart = roomPlayers.length >= 2 && allReady;

    return (
        <div data-testid="room-view" className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="bg-[var(--keyboard-bg)] p-8 rounded-2xl shadow-2xl border border-[var(--text-secondary)]/10 max-w-2xl w-full">
                {/* 房間資訊 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">{currentRoom.name}</h1>
                    <div className="text-sm opacity-70 flex gap-4">
                        <span>模式: {currentRoom.gameConfig.mode}</span>
                        <span>時長: {currentRoom.gameConfig.duration}秒</span>
                        <span>大小寫: {currentRoom.gameConfig.caseMode}</span>
                    </div>
                    <div className="mt-2 text-sm opacity-50">
                        房間代碼: <span className="font-mono font-bold">{currentRoom.id}</span>
                    </div>
                </div>

                {/* 玩家列表 */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Users size={20} className="text-[var(--accent)]" />
                        玩家 ({roomPlayers.length}/{currentRoom.maxPlayers})
                    </h2>

                    <div className="space-y-3">
                        {roomPlayers.map((player) => (
                            <div
                                key={player.id}
                                className={clsx(
                                    "bg-[var(--bg-primary)] p-4 rounded-lg flex items-center justify-between",
                                    player.id === playerId && "border-2 border-[var(--accent)]"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center font-bold">
                                        {player.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold">
                                            {player.name}
                                            {player.id === playerId && <span className="text-[var(--accent)] ml-2">(你)</span>}
                                        </p>
                                        {!player.isConnected && (
                                            <p className="text-xs text-red-500">已斷線</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {player.isReady ? (
                                        <span className="flex items-center gap-1 text-green-500">
                                            <Check size={16} />
                                            準備
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 opacity-50">
                                            <X size={16} />
                                            未準備
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 遊戲開始提示 */}
                {canStart && (
                    <div className="mb-6 p-4 bg-[var(--accent)]/20 border border-[var(--accent)] rounded-lg text-center">
                        <p className="font-bold text-[var(--accent)]">所有玩家已準備！遊戲即將開始...</p>
                    </div>
                )}

                {/* 操作按鈕 */}
                <div className="flex gap-4">
                    <button
                        data-testid="ready-button"
                        onClick={() => setReady(!isReady)}
                        className={clsx(
                            "flex-1 px-6 py-3 rounded-lg font-bold transition-all",
                            isReady
                                ? "bg-[var(--bg-primary)] border-2 border-[var(--text-secondary)]/20 hover:opacity-70"
                                : "bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_0_20px_var(--accent)]/50 hover:opacity-90"
                        )}
                    >
                        {isReady ? '取消準備' : '準備'}
                    </button>

                    <button
                        onClick={leaveRoom}
                        className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-500 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                    >
                        <LogOut size={18} />
                        離開房間
                    </button>
                </div>
            </div>
        </div>
    );
}
