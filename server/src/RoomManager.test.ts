import { beforeEach, describe, expect, it } from 'vitest';
import { RoomManager } from './RoomManager.js';
import type { GameConfig, Player } from './types.js';

const config: GameConfig = {
    mode: 'English',
    caseMode: 'lowercase',
    duration: 60,
};

const player = (id: string, name = id): Omit<Player, 'score' | 'errors' | 'currentIndex' | 'isReady'> => ({
    id,
    socketId: `socket-${id}`,
    name,
    isConnected: true,
});

describe('RoomManager', () => {
    let manager: RoomManager;

    beforeEach(() => {
        manager = new RoomManager();
    });

    it('creates and joins a bounded room', () => {
        const room = manager.createRoom('Lab', config, player('one', 'Alice'));
        manager.joinRoom(room.id, player('two', 'Bob'));
        manager.joinRoom(room.id, player('three', 'Carol'));
        manager.joinRoom(room.id, player('four', 'Dan'));

        expect(room.players.size).toBe(4);
        expect(() => manager.joinRoom(room.id, player('five', 'Eve'))).toThrow('房間已滿');
    });

    it('rejects duplicate display names and excess rooms', () => {
        const limited = new RoomManager(1);
        const room = limited.createRoom('One', config, player('one', 'Alice'));

        expect(() => limited.joinRoom(room.id, player('two', 'alice'))).toThrow('相同玩家名稱');
        expect(() => limited.createRoom('Two', config, player('three'))).toThrow('房間數已達上限');
    });

    it('requires two ready players and scores inputs on the server', () => {
        const room = manager.createRoom('Lab', config, player('one'));
        manager.setPlayerReady(room.id, 'one', true);
        expect(manager.startGame(room.id)).toBe(false);

        manager.joinRoom(room.id, player('two'));
        manager.setPlayerReady(room.id, 'two', true);
        expect(manager.startGame(room.id)).toBe(true);

        const expected = room.charSequence[0];
        const wrong = expected === 'a' ? 'b' : 'a';
        expect(manager.updatePlayerProgress(room.id, 'one', wrong)).toEqual({
            accepted: true,
            correct: false,
        });
        expect(manager.updatePlayerProgress(room.id, 'one', expected)).toEqual({
            accepted: true,
            correct: true,
        });
        expect(room.players.get('one')).toMatchObject({ score: 1, errors: 1, currentIndex: 1 });
    });

    it('prunes stale waiting rooms', () => {
        const room = manager.createRoom('Old', config, player('one'));
        room.createdAt = 0;
        expect(manager.pruneStaleRooms(31 * 60 * 1_000)).toBe(1);
        expect(manager.getRoom(room.id)).toBeUndefined();
    });
});
