// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './useGameStore';
import { useSettingsStore } from './useSettingsStore';

describe('game store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        vi.stubGlobal('crypto', { randomUUID: () => 'session-id' });
        localStorage.clear();
        useSettingsStore.setState({ gameMode: 'English', timeMode: 60 });
        useGameStore.getState().resetGame();
        useGameStore.getState().clearHistory();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('records inputs and creates a scored session', () => {
        const game = useGameStore.getState();
        game.startGame();
        game.setTargetChar('a');

        vi.advanceTimersByTime(500);
        useGameStore.getState().registerInput(true, 'KeyA');
        vi.advanceTimersByTime(500);
        useGameStore.getState().registerInput(false, 'KeyA', 'KeyS', 's');
        vi.advanceTimersByTime(59_000);
        useGameStore.getState().endGame();

        const state = useGameStore.getState();
        expect(state.score).toBe(1);
        expect(state.errors).toBe(1);
        expect(state.gameHistory).toHaveLength(1);
        expect(state.gameHistory[0]).toMatchObject({
            id: 'session-id',
            accuracy: 50,
            ppm: 1,
            avgLatency: 500,
            duration: 60,
        });
    });
});
