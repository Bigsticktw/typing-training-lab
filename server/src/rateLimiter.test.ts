import { describe, expect, it, vi } from 'vitest';
import { SocketRateLimiter } from './rateLimiter.js';

describe('SocketRateLimiter', () => {
    it('limits each socket and event independently', () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const limiter = new SocketRateLimiter();

        expect(limiter.consume('socket-1', 'input', 2, 1_000)).toBe(true);
        expect(limiter.consume('socket-1', 'input', 2, 1_000)).toBe(true);
        expect(limiter.consume('socket-1', 'input', 2, 1_000)).toBe(false);
        expect(limiter.consume('socket-2', 'input', 2, 1_000)).toBe(true);

        vi.advanceTimersByTime(1_000);
        expect(limiter.consume('socket-1', 'input', 2, 1_000)).toBe(true);
        vi.useRealTimers();
    });
});
