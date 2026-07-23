import type { GameConfig, Player, Room, RoomListItem } from './types.js';
import { generateCharSequence } from './utils/charGenerator.js';

type NewPlayer = Omit<Player, 'score' | 'errors' | 'currentIndex' | 'isReady'>;

export interface InputResult {
    accepted: boolean;
    correct: boolean;
}

export class RoomManager {
    private readonly rooms = new Map<string, Room>();

    constructor(private readonly maxRooms = 100) {}

    createRoom(name: string, config: GameConfig, creator: NewPlayer): Room {
        if (this.rooms.size >= this.maxRooms) {
            throw new Error('伺服器房間數已達上限，請稍後再試');
        }

        const roomId = this.generateRoomId();
        const player = this.createPlayer(creator);
        const room: Room = {
            id: roomId,
            name,
            players: new Map([[player.id, player]]),
            maxPlayers: 4,
            status: 'waiting',
            gameConfig: config,
            charSequence: [],
            createdAt: Date.now(),
        };

        this.rooms.set(roomId, room);
        return room;
    }

    joinRoom(roomId: string, player: NewPlayer): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        if (room.status !== 'waiting') throw new Error('遊戲已開始，無法加入');
        if (room.players.size >= room.maxPlayers) throw new Error('房間已滿');

        const normalizedName = player.name.toLocaleLowerCase();
        const duplicateName = Array.from(room.players.values()).some(
            existing => existing.name.toLocaleLowerCase() === normalizedName,
        );
        if (duplicateName) throw new Error('房間內已有相同玩家名稱');

        const newPlayer = this.createPlayer(player);
        room.players.set(newPlayer.id, newPlayer);
        return room;
    }

    leaveRoom(roomId: string, playerId: string): void {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players.delete(playerId);
        if (room.players.size === 0) this.rooms.delete(roomId);
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    getRoomList(): RoomListItem[] {
        return Array.from(this.rooms.values())
            .filter(room => room.status === 'waiting')
            .map(room => this.toRoomListItem(room));
    }

    setPlayerReady(roomId: string, playerId: string, isReady: boolean): boolean {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'waiting') return false;

        const player = room.players.get(playerId);
        if (!player || !player.isConnected) return false;

        player.isReady = isReady;
        return true;
    }

    isAllPlayersReady(roomId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'waiting' || room.players.size < 2) return false;
        return Array.from(room.players.values()).every(player => player.isReady && player.isConnected);
    }

    startGame(roomId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room || !this.isAllPlayersReady(roomId)) return false;

        const estimatedChars = Math.min(2_000, Math.ceil(room.gameConfig.duration * 3));
        room.charSequence = generateCharSequence(room.gameConfig, estimatedChars);
        room.status = 'playing';
        room.startTime = Date.now();
        room.endTime = room.startTime + room.gameConfig.duration * 1_000;

        room.players.forEach(player => {
            player.score = 0;
            player.errors = 0;
            player.currentIndex = 0;
        });
        return true;
    }

    endGame(roomId: string): void {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'playing') return;

        room.status = 'finished';
        room.players.forEach(player => {
            player.isReady = false;
        });
    }

    updatePlayerProgress(roomId: string, playerId: string, inputChar: string): InputResult {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'playing') return { accepted: false, correct: false };

        const player = room.players.get(playerId);
        if (!player || !player.isConnected) return { accepted: false, correct: false };

        const expectedChar = room.charSequence[player.currentIndex];
        if (!expectedChar) return { accepted: false, correct: false };

        const correct = inputChar === expectedChar;
        if (correct) {
            player.score += 1;
            player.currentIndex += 1;
        } else {
            player.errors += 1;
        }

        return { accepted: true, correct };
    }

    quickMatch(config: GameConfig, player: NewPlayer): Room {
        const availableRoom = Array.from(this.rooms.values()).find(room =>
            room.status === 'waiting' &&
            room.players.size < room.maxPlayers &&
            !Array.from(room.players.values()).some(
                existing => existing.name.toLocaleLowerCase() === player.name.toLocaleLowerCase(),
            ) &&
            this.isConfigMatch(room.gameConfig, config),
        );

        return availableRoom
            ? this.joinRoom(availableRoom.id, player)!
            : this.createRoom('快速配對房間', config, player);
    }

    setPlayerConnection(roomId: string, playerId: string, isConnected: boolean): void {
        const player = this.rooms.get(roomId)?.players.get(playerId);
        if (player) player.isConnected = isConnected;
    }

    pruneStaleRooms(
        now = Date.now(),
        waitingMaxAgeMs = 30 * 60 * 1_000,
        finishedMaxAgeMs = 5 * 60 * 1_000,
    ): number {
        let removed = 0;
        for (const [roomId, room] of this.rooms) {
            const age = now - room.createdAt;
            const staleWaitingRoom = room.status === 'waiting' && age > waitingMaxAgeMs;
            const staleFinishedRoom = room.status === 'finished' && age > finishedMaxAgeMs;
            if (room.players.size === 0 || staleWaitingRoom || staleFinishedRoom) {
                this.rooms.delete(roomId);
                removed += 1;
            }
        }
        return removed;
    }

    private createPlayer(player: NewPlayer): Player {
        return {
            ...player,
            score: 0,
            errors: 0,
            currentIndex: 0,
            isReady: false,
            isConnected: true,
        };
    }

    private isConfigMatch(first: GameConfig, second: GameConfig): boolean {
        return first.mode === second.mode &&
            first.duration === second.duration &&
            first.caseMode === second.caseMode &&
            first.handMode === second.handMode &&
            JSON.stringify(first.activeRows ?? []) === JSON.stringify(second.activeRows ?? []);
    }

    private generateRoomId(): string {
        let roomId = '';
        do {
            roomId = Math.random().toString(36).slice(2, 9).toUpperCase();
        } while (!roomId || this.rooms.has(roomId));
        return roomId;
    }

    private toRoomListItem(room: Room): RoomListItem {
        return {
            id: room.id,
            name: room.name,
            playerCount: room.players.size,
            maxPlayers: room.maxPlayers,
            status: room.status,
            gameConfig: room.gameConfig,
        };
    }
}
