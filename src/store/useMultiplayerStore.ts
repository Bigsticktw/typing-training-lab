import { create } from 'zustand';
import { socketService } from '../services/SocketService';
import type { Player, RoomListItem, GameConfig } from '../../server/src/types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type MultiplayerStatus = 'lobby' | 'in-room' | 'playing' | 'finished';

interface MultiplayerState {
    // 連線狀態
    connectionStatus: ConnectionStatus;

    // 當前玩家資訊
    playerName: string;
    playerId: string | null;

    // 房間狀態
    status: MultiplayerStatus;
    currentRoom: RoomListItem | null;
    roomPlayers: Player[];
    availableRooms: RoomListItem[];

    // 遊戲狀態
    charSequence: string[];
    currentCharIndex: number;
    gameStartTime: number | null;
    playerStats: Map<string, { score: number; errors: number; currentIndex: number }>;

    // 錯誤訊息
    errorMessage: string | null;

    // Actions
    connect: () => void;
    disconnect: () => void;
    setPlayerName: (name: string) => void;

    // 房間操作
    createRoom: (name: string, config: GameConfig) => void;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
    refreshRoomList: () => void;
    quickMatch: (config: GameConfig) => void;

    // 玩家操作
    setReady: (isReady: boolean) => void;

    // 遊戲操作
    sendInput: (char: string) => void;

    // 內部狀態更新
    setConnectionStatus: (status: ConnectionStatus) => void;
    setError: (message: string | null) => void;
    clearError: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
    connectionStatus: 'disconnected',
    playerName: '',
    playerId: null,
    status: 'lobby',
    currentRoom: null,
    roomPlayers: [],
    availableRooms: [],
    charSequence: [],
    currentCharIndex: 0,
    gameStartTime: null,
    playerStats: new Map(),
    errorMessage: null,

    connect: () => {
        set({ connectionStatus: 'connecting' });

        const socket = socketService.connect();

        // 註冊所有事件監聽
        socket.on('connect', () => {
            set({ connectionStatus: 'connected', errorMessage: null });
        });

        socket.on('disconnect', () => {
            set({ connectionStatus: 'disconnected' });
        });

        socket.on('error', (message) => {
            set({ errorMessage: message });
        });

        // 房間事件
        socketService.onRoomJoined(({ room, players }) => {
            const state = get();
            const myPlayer = players.find(p => p.name === state.playerName);

            set({
                status: 'in-room',
                currentRoom: room,
                roomPlayers: players,
                playerId: myPlayer?.id || null,
                errorMessage: null,
            });
        });

        socketService.onRoomLeft(() => {
            set({
                status: 'lobby',
                currentRoom: null,
                roomPlayers: [],
                playerId: null,
                charSequence: [],
                currentCharIndex: 0,
                gameStartTime: null,
                playerStats: new Map(),
            });
        });

        socketService.onRoomList((rooms) => {
            set({ availableRooms: rooms });
        });

        // 玩家事件
        socketService.onPlayerJoined((player) => {
            set((state) => ({
                roomPlayers: [...state.roomPlayers, player],
            }));
        });

        socketService.onPlayerLeft((playerId) => {
            set((state) => ({
                roomPlayers: state.roomPlayers.filter(p => p.id !== playerId),
            }));
        });

        socketService.onPlayerReady((playerId, isReady) => {
            set((state) => ({
                roomPlayers: state.roomPlayers.map(p =>
                    p.id === playerId ? { ...p, isReady } : p
                ),
            }));
        });

        // 遊戲事件
        socketService.onGameStart(({ charSequence, startTime }) => {
            set({
                status: 'playing',
                charSequence,
                currentCharIndex: 0,
                gameStartTime: startTime,
                playerStats: new Map(),
            });
        });

        socketService.onGameUpdate((updates) => {
            const newStats = new Map();
            updates.forEach(update => {
                newStats.set(update.playerId, {
                    score: update.score,
                    errors: update.errors,
                    currentIndex: update.currentIndex,
                });
            });
            const state = get();
            const ownUpdate = state.playerId
                ? updates.find(update => update.playerId === state.playerId)
                : undefined;
            set({
                playerStats: newStats,
                currentCharIndex: ownUpdate?.currentIndex ?? state.currentCharIndex,
            });
        });

        socketService.onGameEnd(({ players }) => {
            set({
                status: 'finished',
                roomPlayers: players,
            });
        });
    },

    disconnect: () => {
        socketService.disconnect();
        set({
            connectionStatus: 'disconnected',
            status: 'lobby',
            currentRoom: null,
            roomPlayers: [],
            availableRooms: [],
            playerId: null,
        });
    },

    setPlayerName: (name) => {
        set({ playerName: name });
    },

    createRoom: (name, config) => {
        const state = get();
        if (!state.playerName) {
            set({ errorMessage: '請先設定玩家名稱' });
            return;
        }
        socketService.createRoom(name, config, state.playerName);
    },

    joinRoom: (roomId) => {
        const state = get();
        if (!state.playerName) {
            set({ errorMessage: '請先設定玩家名稱' });
            return;
        }
        socketService.joinRoom(roomId, state.playerName);
    },

    leaveRoom: () => {
        socketService.leaveRoom();
    },

    refreshRoomList: () => {
        socketService.requestRoomList();
    },

    quickMatch: (config) => {
        const state = get();
        if (!state.playerName) {
            set({ errorMessage: '請先設定玩家名稱' });
            return;
        }
        socketService.quickMatch(config, state.playerName);
    },

    setReady: (isReady) => {
        socketService.setReady(isReady);
    },

    sendInput: (char) => {
        socketService.sendInput(char);
    },

    setConnectionStatus: (status) => {
        set({ connectionStatus: status });
    },

    setError: (message) => {
        set({ errorMessage: message });
    },

    clearError: () => {
        set({ errorMessage: null });
    },
}));
