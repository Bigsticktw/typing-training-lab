import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCharSequence } from './charGenerator.js';

describe('server character generator', () => {
    afterEach(() => vi.restoreAllMocks());

    it('generates the requested lowercase sequence', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(generateCharSequence({
            mode: 'English',
            caseMode: 'lowercase',
            duration: 60,
            activeRows: [3],
        }, 3)).toEqual(['a', 'a', 'a']);
    });

    it('supports uppercase and mixed sequences', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(generateCharSequence({
            mode: 'English',
            caseMode: 'uppercase',
            duration: 60,
            activeRows: [3],
        }, 2)).toEqual(['A', 'A']);
        expect(generateCharSequence({
            mode: 'English',
            caseMode: 'mixed',
            duration: 60,
        }, 2)).toHaveLength(2);
    });
});
