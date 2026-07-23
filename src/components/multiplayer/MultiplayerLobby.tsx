import { useEffect, useState } from 'react';
import { useMultiplayerStore } from '../../store/useMultiplayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Users, Zap, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { GameConfig } from '../../../server/src/types';

export function MultiplayerLobby() {
    const {
        connectionStatus,
        playerName,
        availableRooms,
        errorMessage,
        connect,
        setPlayerName,
        createRoom,
        joinRoom,
        refreshRoomList,
        quickMatch,
        clearError,
    } = useMultiplayerStore();

    const { gameMode, caseMode, timeMode } = useSettingsStore();

    const [localPlayerName, setLocalPlayerName] = useState(playerName || '');
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    // 自動連接
    useEffect(() => {
        if (connectionStatus === 'disconnected') {
            connect();
        }
    }, [connectionStatus, connect]);

    // 定期刷新房間列表
    useEffect(() => {
        if (connectionStatus === 'connected') {
            refreshRoomList();
            const interval = setInterval(refreshRoomList, 3000);
            return () => clearInterval(interval);
        }
    }, [connectionStatus, refreshRoomList]);

    const handleSetPlayerName = () => {
        if (localPlayerName.trim()) {
            setPlayerName(localPlayerName.trim());
        }
    };

    const handleCreateRoom = () => {
        if (!newRoomName.trim()) return;

        const config: GameConfig = {
            mode: gameMode,
            duration: typeof timeMode === 'number' ? timeMode : 60,
            caseMode,
        };

        createRoom(newRoomName.trim(), config);
        setIsCreatingRoom(false);
        setNewRoomName('');
    };

    const handleQuickMatch = () => {
        const config: GameConfig = {
            mode: gameMode,
            duration: typeof timeMode === 'number' ? timeMode : 60,
            caseMode,
        };

        quickMatch(config);
    };

    const handleJoinRoom = (roomId: string) => {
        joinRoom(roomId);
    };

    const isNameSet = playerName.trim().length > 0;

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
            {/* 連線狀態 */}
            <div data-testid="connection-status" className="flex items-center gap-2 text-sm">
                {connectionStatus === 'connected' ? (
                    <>
                        <Wifi className="text-green-500" size={16} />
                        <span className="text-green-500">已連線</span>
                    </>
                ) : connectionStatus === 'connecting' ? (
                    <>
                        <WifiOff className="text-yellow-500 animate-pulse" size={16} />
                        <span className="text-yellow-500">連線中...</span>
                    </>
                ) : (
                    <>
                        <WifiOff className="text-red-500" size={16} />
                        <span className="text-red-500">未連線</span>
                    </>
                )}
            </div>

            {/* 錯誤訊息 */}
            {errorMessage && (
                <div className="bg-red-500/20 border border-red-500 text-red-500 px-4 py-2 rounded-lg flex items-center justify-between gap-4">
                    <span>{errorMessage}</span>
                    <button onClick={clearError} className="hover:opacity-70">✕</button>
                </div>
            )}

            {/* 玩家名稱設定 */}
            {!isNameSet && (
                <div className="bg-[var(--keyboard-bg)] p-8 rounded-2xl shadow-2xl border border-[var(--text-secondary)]/10 max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-4 text-center">設定玩家名稱</h2>
                    <input
                        data-testid="player-name-input"
                        type="text"
                        value={localPlayerName}
                        onChange={(e) => setLocalPlayerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetPlayerName()}
                        placeholder="輸入你的名稱"
                        className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-lg focus:outline-none focus:border-[var(--accent)] text-lg"
                        maxLength={20}
                    />
                    <button
                        data-testid="confirm-player-name"
                        onClick={handleSetPlayerName}
                        disabled={!localPlayerName.trim()}
                        className="w-full mt-4 px-6 py-3 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        確認
                    </button>
                </div>
            )}

            {/* 大廳主介面 */}
            {isNameSet && (
                <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 快速開始區域 */}
                    <div className="bg-[var(--keyboard-bg)] p-8 rounded-2xl shadow-2xl border border-[var(--text-secondary)]/10">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Zap className="text-[var(--accent)]" />
                            快速開始
                        </h2>

                        <div className="space-y-4">
                            <button
                                onClick={handleQuickMatch}
                                disabled={connectionStatus !== 'connected'}
                                className="w-full px-6 py-4 bg-[var(--accent)] text-[var(--bg-primary)] rounded-xl font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_var(--accent)]/50"
                            >
                                <Zap size={20} />
                                快速配對
                            </button>

                            <button
                                data-testid="open-create-room"
                                onClick={() => setIsCreatingRoom(true)}
                                disabled={connectionStatus !== 'connected'}
                                className="w-full px-6 py-4 bg-[var(--bg-primary)] border-2 border-[var(--accent)] text-[var(--accent)] rounded-xl font-bold text-lg hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                建立房間
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-[var(--bg-primary)]/50 rounded-lg">
                            <p className="text-sm opacity-70">
                                <strong>玩家：</strong> {playerName}
                            </p>
                            <p className="text-sm opacity-70 mt-1">
                                <strong>模式：</strong> {gameMode} / {caseMode}
                            </p>
                            <p className="text-sm opacity-70 mt-1">
                                <strong>時長：</strong> {typeof timeMode === 'number' ? `${timeMode}秒` : '無限'}
                            </p>
                        </div>
                    </div>

                    {/* 房間列表 */}
                    <div className="bg-[var(--keyboard-bg)] p-8 rounded-2xl shadow-2xl border border-[var(--text-secondary)]/10">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Users className="text-[var(--accent)]" />
                                房間列表
                            </h2>
                            <button
                                onClick={refreshRoomList}
                                className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                                title="刷新"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div data-testid="room-list" className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {availableRooms.length === 0 ? (
                                <p className="text-center text-[var(--text-secondary)] py-8">
                                    目前沒有可用的房間
                                </p>
                            ) : (
                                availableRooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className="bg-[var(--bg-primary)] p-4 rounded-lg hover:border-[var(--accent)] border border-transparent transition-all cursor-pointer"
                                        onClick={() => handleJoinRoom(room.id)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-bold">{room.name}</h3>
                                            <span className="text-sm opacity-70">
                                                {room.playerCount}/{room.maxPlayers}
                                            </span>
                                        </div>
                                        <div className="text-xs opacity-60 flex gap-4">
                                            <span>{room.gameConfig.mode}</span>
                                            <span>{room.gameConfig.duration}秒</span>
                                            <span>{room.gameConfig.caseMode}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 建立房間對話框 */}
            {isCreatingRoom && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsCreatingRoom(false)}>
                    <div className="bg-[var(--keyboard-bg)] p-8 rounded-2xl shadow-2xl border border-[var(--text-secondary)]/10 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">建立房間</h2>
                        <input
                            data-testid="room-name-input"
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                            placeholder="房間名稱"
                            className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-lg focus:outline-none focus:border-[var(--accent)] text-lg"
                            maxLength={30}
                            autoFocus
                        />
                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={() => setIsCreatingRoom(false)}
                                className="flex-1 px-6 py-3 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-lg font-bold hover:opacity-70"
                            >
                                取消
                            </button>
                            <button
                                data-testid="confirm-create-room"
                                onClick={handleCreateRoom}
                                disabled={!newRoomName.trim()}
                                className="flex-1 px-6 py-3 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                建立
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
