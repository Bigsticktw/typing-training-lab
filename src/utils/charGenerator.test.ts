import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKeyCodeFromChar, getRandomChar } from './charGenerator';

describe('character generator', () => {
    afterEach(() => vi.restoreAllMocks());

    it('respects row and case settings', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(getRandomChar('English', 'lowercase', [3], 'all')).toBe('a');
        expect(getRandomChar('English', 'uppercase', [3], 'all')).toBe('A');
    });

    it('uses a custom key selection before row filters', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(getRandomChar('English', 'lowercase', [1], 'all', ['KeyZ'], true)).toBe('z');
    });

    it('falls back safely and maps characters to physical keys', () => {
        expect(getRandomChar('English', 'lowercase', [], 'all')).toBe('a');
        expect(getKeyCodeFromChar('A', 'English')).toBe('KeyA');
        expect(getKeyCodeFromChar('€', 'English')).toBeNull();
    });
});
