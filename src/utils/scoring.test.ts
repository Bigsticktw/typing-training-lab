import { describe, expect, it } from 'vitest';
import {
    calculateAccuracy,
    calculateAverageLatency,
    calculatePpm,
} from './scoring';

describe('scoring', () => {
    it('calculates rounded accuracy and handles empty input', () => {
        expect(calculateAccuracy(8, 10)).toBe(80);
        expect(calculateAccuracy(0, 0)).toBe(0);
    });

    it('calculates correct characters per minute', () => {
        expect(calculatePpm(30, 1_000, 61_000)).toBe(30);
        expect(calculatePpm(30, 1_000, 1_000)).toBe(0);
    });

    it('averages valid latency samples', () => {
        expect(calculateAverageLatency({ KeyA: [100, 200], KeyB: [300] })).toBe(200);
        expect(calculateAverageLatency({ KeyA: [-1, Number.NaN] })).toBe(0);
    });
});
