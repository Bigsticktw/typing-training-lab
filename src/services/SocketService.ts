import { io, Socket } from 'socket.io-client';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    Player,
    RoomListItem,
    GameConfig,
    GameUpdate
} from '../../server/src/types';

export type MultiplayerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketService {
    private socket: MultiplayerSocket | null = null;
    private serverUrl: string = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3001';

    /**
     * 連接到伺服器
     */
    connect(url?: string): MultiplayerSocket {
        if (url) {
            this.serverUrl = url;
        }

        if (this.socket?.connected) {
            return this.socket;
        }

        this.socket = io(this.serverUrl, {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        // 連線事件監聽
        this.socket.on('connect', () => {
            console.log('[Socket] Connected to server');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        this.socket.on('error', (error) => {
            console.error('[Socket] Error:', error);
        });

        return this.socket;
    }

    /**
     * 斷開連接
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * 取得 Socket 實例
     */
    getSocket(): MultiplayerSocket | null {
        return this.socket;
    }

    /**
     * 檢查是否已連接
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    // ===== 房間相關 =====

    createRoom(name: string, config: GameConfig, playerName: string): void {
        this.socket?.emit('room:create', { name, config, playerName });
    }

    joinRoom(roomId: string, playerName: string): void {
        this.socket?.emit('room:join', { roomId, playerName });
    }

    leaveRoom(): void {
        this.socket?.emit('room:leave');
    }

    requestRoomList(): void {
        this.socket?.emit('room:list');
    }

    quickMatch(config: GameConfig, playerName: string): void {
        this.socket?.emit('room:quickMatch', { config, playerName });
    }

    // ===== 玩家相關 =====

    setReady(isReady: boolean): void {
        this.socket?.emit('player:ready', isReady);
    }

    // ===== 遊戲相關 =====

    sendInput(char: string): void {
        this.socket?.emit('game:input', { char });
    }

    // ===== 事件監聽註冊 =====

    onRoomJoined(callback: (data: { room: RoomListItem; players: Player[] }) => void): void {
        this.socket?.on('room:joined', callback);
    }

    onRoomLeft(callback: () => void): void {
        this.socket?.on('room:left', callback);
    }

    onRoomList(callback: (rooms: RoomListItem[]) => void): void {
        this.socket?.on('room:list', callback);
    }

    onPlayerJoined(callback: (player: Player) => void): void {
        this.socket?.on('player:joined', callback);
    }

    onPlayerLeft(callback: (playerId: string) => void): void {
        this.socket?.on('player:left', callback);
    }

    onPlayerReady(callback: (playerId: string, isReady: boolean) => void): void {
        this.socket?.on('player:ready', callback);
    }

    onGameStart(callback: (data: { charSequence: string[]; startTime: number }) => void): void {
        this.socket?.on('game:start', callback);
    }

    onGameUpdate(callback: (updates: GameUpdate[]) => void): void {
        this.socket?.on('game:update', callback);
    }

    onGameEnd(callback: (results: { players: Player[]; duration: number }) => void): void {
        this.socket?.on('game:end', callback);
    }

    onError(callback: (message: string) => void): void {
        this.socket?.on('error', callback);
    }

    // ===== 移除事件監聽 =====

}

// 單例模式
export const socketService = new SocketService();
