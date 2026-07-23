import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore, type GameMode } from './useSettingsStore';
import {
    calculateAccuracy,
    calculateAverageLatency,
    calculatePpm,
} from '../utils/scoring';

export type GameStatus = 'idle' | 'playing' | 'finished';
type Feedback = 'idle' | 'correct' | 'wrong';

export interface KeystrokeTiming {
    targetKey: string;  // keyCode (例如 KeyR)
    targetChar: string; // 實際的目標字符 (例如 'R' 或 'r')
    timestamp: number;
    latency: number;
    isCorrect: boolean;
    pressedKey?: string; // 實際按下的鍵 keyCode (錯誤時)
    pressedChar?: string; // 實際按下的字符 (錯誤時)
}

export interface GameSession {
    id: string;
    timestamp: number;
    mode: GameMode;
    score: number;
    errors: number;
    accuracy: number;
    ppm: number;
    avgLatency: number;
    keyLatencies: Record<string, number[]>;
    keyErrors: Record<string, number>;
    keyMistakes: Record<string, Record<string, number>>; // 目標鍵 -> { 實際按鍵: 次數 }
    keystrokeTimings: KeystrokeTiming[]; // 新增:完整按鍵時間序列
    duration: number; // 秒
}

interface GameState {
    status: GameStatus;
    targetChar: string;
    feedback: Feedback;
    inputCount: number;

    score: number;
    errors: number;
    totalKeystrokes: number;
    startTime: number;
    timeLeft: number;

    charAppearedAt: number;
    keyLatencies: Record<string, number[]>;
    keyErrors: Record<string, number>;
    keyMistakes: Record<string, Record<string, number>>; // 新增：目標鍵 -> 按錯成什麼鍵
    keystrokeTimings: KeystrokeTiming[]; // 新增:當前遊戲按鍵時間序列

    // 當前訓練的按鍵統計（用於加權出題）
    currentSessionKeyCount: Record<string, number>; // keyCode -> 出題次數
    currentSessionKeyErrors: Record<string, number>; // keyCode -> 錯誤次數

    // 新增：歷史紀錄
    gameHistory: GameSession[];

    // Actions
    startGame: () => void;
    endGame: () => void;
    resetGame: () => void;
    restartGame: () => void;
    setTargetChar: (char: string) => void;
    registerInput: (isCorrect: boolean, keyCode?: string, pressedKey?: string, pressedChar?: string) => void;
    tickTimer: () => void;
    setTimeLeft: (time: number) => void;
    clearFeedback: () => void;
    recordCharAppeared: () => void;
    getKeyStatistics: () => { keyCount: Record<string, number>; keyErrors: Record<string, number> };
    clearHistory: () => void;
    wantsRestart: boolean;
    setWantsRestart: (wants: boolean) => void;
}

export const useGameStore = create<GameState>()(
    persist(
        (set, get) => ({
            status: 'idle',
            targetChar: '',
            feedback: 'idle',
            inputCount: 0,

            score: 0,
            errors: 0,
            totalKeystrokes: 0,
            startTime: 0,
            timeLeft: 0,
            charAppearedAt: 0,
            keyLatencies: {},
            keyErrors: {},
            keyMistakes: {},
            keystrokeTimings: [],

            currentSessionKeyCount: {},
            currentSessionKeyErrors: {},
            gameHistory: [],

            startGame: () => {
                const timeMode = useSettingsStore.getState().timeMode;
                const initialTime = timeMode === 'infinite' ? Infinity : (typeof timeMode === 'number' ? timeMode : 60);

                set({
                    status: 'playing',
                    score: 0,
                    errors: 0,
                    totalKeystrokes: 0,
                    inputCount: 0,
                    startTime: Date.now(),
                    timeLeft: initialTime,
                    feedback: 'idle',
                    targetChar: '',
                    charAppearedAt: Date.now(),
                    keyLatencies: {},
                    keyErrors: {},
                    keyMistakes: {},
                    keystrokeTimings: [],
                    currentSessionKeyCount: {},
                    currentSessionKeyErrors: {},
                    wantsRestart: false,
                });
            },

            endGame: () => {
                const state = get();
                if (state.status !== 'playing') return;

                // 計算當局數據
                const elapsedMs = Date.now() - state.startTime;
                const ppm = calculatePpm(state.score, state.startTime, Date.now());
                const accuracy = calculateAccuracy(state.score, state.totalKeystrokes);
                const avgLatency = calculateAverageLatency(state.keyLatencies);

                const timeMode = useSettingsStore.getState().timeMode;
                const configuredDuration = timeMode === 'infinite' ? Math.round(elapsedMs / 1000) : (typeof timeMode === 'number' ? timeMode : 60);

                const session: GameSession = {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    mode: useSettingsStore.getState().gameMode,
                    score: state.score,
                    errors: state.errors,
                    accuracy,
                    ppm,
                    avgLatency,
                    keyLatencies: { ...state.keyLatencies },
                    keyErrors: { ...state.keyErrors },
                    keyMistakes: { ...state.keyMistakes },
                    keystrokeTimings: [...state.keystrokeTimings],
                    duration: configuredDuration
                };

                set({
                    status: 'finished',
                    gameHistory: [session, ...state.gameHistory].slice(0, 100) // 保留最近 100 筆
                });
            },

            resetGame: () => set({
                status: 'idle',
                score: 0,
                errors: 0,
                totalKeystrokes: 0,
                inputCount: 0,
                feedback: 'idle',
                targetChar: '',
                charAppearedAt: 0,
                keyLatencies: {},
                keyErrors: {},
                keystrokeTimings: [],
                wantsRestart: false,
            }),

            restartGame: () => {
                get().startGame();
            },

            setTargetChar: (char) => set({
                targetChar: char,
                feedback: 'idle',
                charAppearedAt: Date.now()
            }),

            setTimeLeft: (time) => set({ timeLeft: time }),

            clearFeedback: () => set({ feedback: 'idle' }),

            recordCharAppeared: () => set({ charAppearedAt: Date.now() }),

            registerInput: (isCorrect, keyCode, pressedKey, pressedChar) => {
                const state = get();
                if (state.status !== 'playing') return;

                const now = Date.now();
                const latency = state.charAppearedAt > 0 ? now - state.charAppearedAt : 0;

                // 更新當前訓練的按鍵統計
                const newKeyCount = { ...state.currentSessionKeyCount };
                const newKeyErrors = { ...state.currentSessionKeyErrors };

                if (keyCode) {
                    // 增加出題次數
                    newKeyCount[keyCode] = (newKeyCount[keyCode] || 0) + 1;

                    // 如果錯誤，增加錯誤次數
                    if (!isCorrect) {
                        newKeyErrors[keyCode] = (newKeyErrors[keyCode] || 0) + 1;
                    }
                }

                // 記錄詳細按鍵時間
                const timing: KeystrokeTiming = {
                    targetKey: keyCode || '',
                    targetChar: state.targetChar, // 儲存實際的目標字符
                    timestamp: now,
                    latency,
                    isCorrect,
                    pressedKey: isCorrect ? undefined : pressedKey,
                    pressedChar: isCorrect ? undefined : pressedChar // 儲存實際按下的字符
                };
                const newTimings = [...state.keystrokeTimings, timing];

                if (isCorrect) {
                    const newLatencies = { ...state.keyLatencies };
                    if (keyCode) {
                        if (!newLatencies[keyCode]) newLatencies[keyCode] = [];
                        newLatencies[keyCode].push(latency);
                    }

                    set({
                        score: state.score + 1,
                        totalKeystrokes: state.totalKeystrokes + 1,
                        feedback: 'correct',
                        inputCount: state.inputCount + 1,
                        keyLatencies: newLatencies,
                        keystrokeTimings: newTimings,
                        currentSessionKeyCount: newKeyCount,
                        currentSessionKeyErrors: newKeyErrors,
                    });
                } else {
                    const newErrors = { ...state.keyErrors };
                    const newMistakes = { ...state.keyMistakes };

                    if (keyCode) {
                        newErrors[keyCode] = (newErrors[keyCode] || 0) + 1;

                        // 記錄「目標鍵 → 實際按鍵」的對應
                        if (pressedKey) {
                            if (!newMistakes[keyCode]) newMistakes[keyCode] = {};
                            newMistakes[keyCode][pressedKey] = (newMistakes[keyCode][pressedKey] || 0) + 1;
                        }
                    }

                    set({
                        errors: state.errors + 1,
                        totalKeystrokes: state.totalKeystrokes + 1,
                        feedback: 'wrong',
                        inputCount: state.inputCount + 1,
                        keyErrors: newErrors,
                        keyMistakes: newMistakes,
                        keystrokeTimings: newTimings,
                        currentSessionKeyCount: newKeyCount,
                        currentSessionKeyErrors: newKeyErrors,
                    });
                }
            },

            getKeyStatistics: () => {
                const state = get();
                return {
                    keyCount: state.currentSessionKeyCount,
                    keyErrors: state.currentSessionKeyErrors
                };
            },

            tickTimer: () => set((state) => {
                if (state.timeLeft === Infinity) return {};
                if (state.timeLeft <= 1) {
                    // 只將時間設為 0，讓 GameCanvas 的 useEffect 調用 endGame
                    // 這樣才能正確執行 session 記錄邏輯
                    return { timeLeft: 0 };
                }
                return { timeLeft: state.timeLeft - 1 };
            }),

            clearHistory: () => set({ gameHistory: [] }),

            wantsRestart: false,
            setWantsRestart: (wants) => set({ wantsRestart: wants })
        }),
        {
            name: 'typing-game-storage',
            partialize: (state) => ({ gameHistory: state.gameHistory }), // 只持久化歷史紀錄
        }
    )
);
