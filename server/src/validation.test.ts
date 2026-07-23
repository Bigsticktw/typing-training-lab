import { describe, expect, it } from 'vitest';
import {
    validateCreateRoom,
    validateGameConfig,
    validateGameInput,
    validateJoinRoom,
} from './validation.js';

describe('socket payload validation', () => {
    it('normalizes room and player input', () => {
        expect(validateCreateRoom({
            name: '  Practice   room ',
            playerName: ' Alice ',
            config: { mode: 'English', caseMode: 'mixed', duration: 60 },
        })).toEqual({
            name: 'Practice room',
            playerName: 'Alice',
            config: { mode: 'English', caseMode: 'mixed', duration: 60 },
        });
        expect(validateJoinRoom({ roomId: 'abc123', playerName: 'Bob' }).roomId).toBe('ABC123');
    });

    it('rejects invalid duration, names, and multi-character input', () => {
        expect(() => validateGameConfig({
            mode: 'English',
            caseMode: 'mixed',
            duration: 5,
        })).toThrow('15 到 300');
        expect(() => validateCreateRoom({
            name: '',
            playerName: 'Alice',
            config: { mode: 'English', caseMode: 'mixed', duration: 60 },
        })).toThrow('不可空白');
        expect(() => validateGameInput({ char: 'ab' })).toThrow('一個字元');
    });

    it('deduplicates and sorts keyboard rows', () => {
        expect(validateGameConfig({
            mode: 'Zhuyin',
            caseMode: 'lowercase',
            duration: 30,
            activeRows: [4, 2, 2],
        }).activeRows).toEqual([2, 4]);
    });
});
