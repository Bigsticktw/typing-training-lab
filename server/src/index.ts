import { randomUUID } from 'node:crypto';
import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { SocketRateLimiter } from './rateLimiter.js';
import {
    validateCreateRoom,
    validateGameInput,
    validateJoinRoom,
    validateQuickMatch,
} from './validation.js';
import type {
    ClientToServerEvents,
    GameUpdate,
    InterServerEvents,
    Player,
    Room,
    ServerToClientEvents,
    SocketData,
} from './types.js';

type AppSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;
type NewPlayer = Omit<Player, 'score' | 'errors' | 'currentIndex' | 'isReady'>;

const DEFAULT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://typing-solo-demo.vercel.app',
];
const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS?.split(',') ?? DEFAULT_ORIGINS)
        .map(origin => origin.trim())
        .filter(Boolean),
);
const isOriginAllowed = (origin?: string): boolean => !origin || allowedOrigins.has(origin);

const app = express();
app.disable('x-powered-by');
app.use(cors({
    origin: (origin, callback) => {
        callback(isOriginAllowed(origin) ? null : new Error('Not allowed by CORS'), isOriginAllowed(origin));
    },
    methods: ['GET'],
}));

const httpServer = createServer(app);
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(httpServer, {
    cors: {
        origin: (origin, callback) => {
            callback(isOriginAllowed(origin) ? null : new Error('Not allowed by CORS'), isOriginAllowed(origin));
        },
        methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 10_000,
});

const roomManager = new RoomManager(100);
const rateLimiter = new SocketRateLimiter();
const socketToPlayer = new Map<string, { playerId: string; roomId: string }>();
const PORT = Number.parseInt(process.env.PORT ?? '10000', 10);

const createPlayer = (socket: AppSocket, name: string): NewPlayer => ({
    id: `player_${randomUUID()}`,
    socketId: socket.id,
    name,
    isConnected: true,
});

const toJoinedPayload = (room: Room) => ({
    room: {
        id: room.id,
        name: room.name,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameConfig: room.gameConfig,
    },
    players: Array.from(room.players.values()),
});

const requireRateLimit = (
    socket: AppSocket,
    event: string,
    limit: number,
    windowMs: number,
): boolean => {
    if (rateLimiter.consume(socket.id, event, limit, windowMs)) return true;
    socket.emit('error', '操作過於頻繁，請稍後再試');
    return false;
};

const ensureNotInRoom = (socket: AppSocket): boolean => {
    if (!socketToPlayer.has(socket.id)) return true;
    socket.emit('error', '請先離開目前房間');
    return false;
};

const joinSocketToRoom = (socket: AppSocket, room: Room, playerId: string): void => {
    socket.join(room.id);
    socketToPlayer.set(socket.id, { playerId, roomId: room.id });
    socket.data.playerId = playerId;
    socket.data.roomId = room.id;
    socket.emit('room:joined', toJoinedPayload(room));
};

const leaveCurrentRoom = (socket: AppSocket, notifySocket: boolean): void => {
    const playerData = socketToPlayer.get(socket.id);
    if (!playerData) return;

    const { playerId, roomId } = playerData;
    socket.leave(roomId);
    roomManager.leaveRoom(roomId, playerId);
    socketToPlayer.delete(socket.id);
    socket.data.playerId = undefined;
    socket.data.roomId = undefined;
    socket.to(roomId).emit('player:left', playerId);
    io.emit('room:list', roomManager.getRoomList());
    if (notifySocket) socket.emit('room:left');
};

io.on('connection', socket => {
    console.log(`[Socket] connected: ${socket.id}`);

    socket.on('room:create', payload => {
        if (!requireRateLimit(socket, 'room:create', 10, 60_000) || !ensureNotInRoom(socket)) return;
        try {
            const { name, config, playerName } = validateCreateRoom(payload);
            const player = createPlayer(socket, playerName);
            const room = roomManager.createRoom(name, config, player);
            joinSocketToRoom(socket, room, player.id);
            io.emit('room:list', roomManager.getRoomList());
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : '建立房間失敗');
        }
    });

    socket.on('room:join', payload => {
        if (!requireRateLimit(socket, 'room:join', 10, 60_000) || !ensureNotInRoom(socket)) return;
        try {
            const { roomId, playerName } = validateJoinRoom(payload);
            const player = createPlayer(socket, playerName);
            const room = roomManager.joinRoom(roomId, player);
            if (!room) {
                socket.emit('error', '找不到房間');
                return;
            }

            joinSocketToRoom(socket, room, player.id);
            socket.to(room.id).emit('player:joined', room.players.get(player.id)!);
            io.emit('room:list', roomManager.getRoomList());
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : '加入房間失敗');
        }
    });

    socket.on('room:quickMatch', payload => {
        if (!requireRateLimit(socket, 'room:quickMatch', 10, 60_000) || !ensureNotInRoom(socket)) return;
        try {
            const { config, playerName } = validateQuickMatch(payload);
            const player = createPlayer(socket, playerName);
            const room = roomManager.quickMatch(config, player);
            joinSocketToRoom(socket, room, player.id);
            if (room.players.size > 1) {
                socket.to(room.id).emit('player:joined', room.players.get(player.id)!);
            }
            io.emit('room:list', roomManager.getRoomList());
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : '快速配對失敗');
        }
    });

    socket.on('room:leave', () => {
        if (!requireRateLimit(socket, 'room:leave', 10, 10_000)) return;
        leaveCurrentRoom(socket, true);
    });

    socket.on('room:list', () => {
        if (!requireRateLimit(socket, 'room:list', 30, 60_000)) return;
        socket.emit('room:list', roomManager.getRoomList());
    });

    socket.on('player:ready', isReady => {
        if (!requireRateLimit(socket, 'player:ready', 20, 60_000)) return;
        if (typeof isReady !== 'boolean') {
            socket.emit('error', '準備狀態格式錯誤');
            return;
        }

        const playerData = socketToPlayer.get(socket.id);
        if (!playerData) return;
        const { playerId, roomId } = playerData;
        if (!roomManager.setPlayerReady(roomId, playerId, isReady)) return;

        io.to(roomId).emit('player:ready', playerId, isReady);
        if (isReady && roomManager.isAllPlayersReady(roomId)) startGame(roomId);
    });

    socket.on('game:input', payload => {
        if (!requireRateLimit(socket, 'game:input', 40, 1_000)) return;
        const playerData = socketToPlayer.get(socket.id);
        if (!playerData) return;

        try {
            const { char } = validateGameInput(payload);
            const { playerId, roomId } = playerData;
            const result = roomManager.updatePlayerProgress(roomId, playerId, char);
            if (!result.accepted) return;

            const room = roomManager.getRoom(roomId);
            if (!room) return;
            const updates: GameUpdate[] = Array.from(room.players.values()).map(player => ({
                playerId: player.id,
                score: player.score,
                errors: player.errors,
                currentIndex: player.currentIndex,
            }));
            io.to(roomId).emit('game:update', updates);
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : '輸入格式錯誤');
        }
    });

    socket.on('disconnect', () => {
        leaveCurrentRoom(socket, false);
        rateLimiter.clear(socket.id);
        console.log(`[Socket] disconnected: ${socket.id}`);
    });
});

const startGame = (roomId: string): void => {
    if (!roomManager.startGame(roomId)) return;
    const room = roomManager.getRoom(roomId);
    if (!room?.startTime) return;

    io.to(roomId).emit('game:start', {
        charSequence: room.charSequence,
        startTime: room.startTime,
    });

    setTimeout(() => endGame(roomId), room.gameConfig.duration * 1_000).unref();
};

const endGame = (roomId: string): void => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing') return;

    roomManager.endGame(roomId);
    io.to(roomId).emit('game:end', {
        players: Array.from(room.players.values()),
        duration: room.gameConfig.duration,
    });
};

setInterval(() => {
    const removed = roomManager.pruneStaleRooms();
    if (removed > 0) io.emit('room:list', roomManager.getRoomList());
}, 60_000).unref();

app.get('/health', (_request, response) => {
    response.json({
        status: 'ok',
        waitingRooms: roomManager.getRoomList().length,
    });
});

httpServer.listen(PORT, () => {
    console.log(`[Server] running on port ${PORT}`);
});
