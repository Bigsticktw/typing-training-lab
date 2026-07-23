export type GameMode = 'English' | 'Zhuyin';
export type CaseMode = 'lowercase' | 'uppercase' | 'mixed';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
    id: string;
    socketId: string;
    name: string;
    avatar?: string;
    score: number;
    errors: number;
    currentIndex: number; // 目前打到第幾個字符
    isReady: boolean;
    isConnected: boolean;
}

export interface GameConfig {
    mode: GameMode;
    duration: number; // 秒
    caseMode: CaseMode;
    activeRows?: number[];
    handMode?: 'all' | 'left' | 'right';
}

export interface Room {
    id: string;
    name: string;
    players: Map<string, Player>;
    maxPlayers: number;
    status: RoomStatus;
    gameConfig: GameConfig;
    startTime?: number;
    endTime?: number;
    charSequence: string[]; // 遊戲中所有玩家共用的字符序列
    createdAt: number;
}

export interface GameUpdate {
    playerId: string;
    score: number;
    errors: number;
    currentIndex: number;
}

export interface RoomListItem {
    id: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
    status: RoomStatus;
    gameConfig: GameConfig;
}

// Socket.IO 事件定義
export interface ServerToClientEvents {
    // 房間相關
    'room:created': (room: RoomListItem) => void;
    'room:joined': (roomData: { room: RoomListItem; players: Player[] }) => void;
    'room:left': () => void;
    'room:list': (rooms: RoomListItem[]) => void;
    'room:updated': (room: RoomListItem) => void;

    // 玩家相關
    'player:joined': (player: Player) => void;
    'player:left': (playerId: string) => void;
    'player:ready': (playerId: string, isReady: boolean) => void;
    'player:disconnected': (playerId: string) => void;
    'player:reconnected': (playerId: string) => void;

    // 遊戲相關
    'game:start': (data: { charSequence: string[]; startTime: number }) => void;
    'game:update': (updates: GameUpdate[]) => void;
    'game:end': (results: { players: Player[]; duration: number }) => void;

    // 錯誤處理
    'error': (message: string) => void;
}

export interface ClientToServerEvents {
    // 房間相關
    'room:create': (data: { name: string; config: GameConfig; playerName: string }) => void;
    'room:join': (data: { roomId: string; playerName: string }) => void;
    'room:leave': () => void;
    'room:list': () => void;
    'room:quickMatch': (data: { config: GameConfig; playerName: string }) => void;

    // 玩家相關
    'player:ready': (isReady: boolean) => void;
    'player:setName': (name: string) => void;

    // 遊戲相關
    'game:input': (data: { char: string }) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    playerId?: string;
    roomId?: string;
}
