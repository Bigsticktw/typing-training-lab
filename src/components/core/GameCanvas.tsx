import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useInputHandler } from '../../hooks/useInputHandler';
import { getRandomChar } from '../../utils/charGenerator';
import { VirtualKeyboard } from '../keyboard/VirtualKeyboard';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { calculatePpm } from '../../utils/scoring';

export const GameCanvas = () => {
    useInputHandler();

    const {
        status, score, errors, totalKeystrokes, targetChar, timeLeft,
        setTargetChar, tickTimer, startGame, resetGame, feedback, inputCount, startTime,
        endGame, // 新增
        getKeyStatistics, // 新增：獲取統計資料
        wantsRestart, setWantsRestart
    } = useGameStore();
    const { gameMode, caseMode, activeRows, handMode, selectedKeys, useCustomKeys } = useSettingsStore();

    const inputRef = useRef<HTMLInputElement>(null);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [upcomingChars, setUpcomingChars] = useState<string[]>([]);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const processedInputCount = useRef(0);

    // 語系衝突偵測


    const generateChar = useCallback(() => {
        const keyStats = getKeyStatistics();
        return getRandomChar(gameMode, caseMode, activeRows, handMode, selectedKeys, useCustomKeys, keyStats);
    }, [gameMode, caseMode, activeRows, handMode, selectedKeys, useCustomKeys, getKeyStatistics]);

    // Focus management & IME Reset
    const resetIME = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.blur();
            inputRef.current.value = "";
            setTimeout(() => {
                inputRef.current?.focus();
            }, 10);
        }
    }, []);

    const handleStart = useCallback(() => {
        setCountdown((previous) => previous ?? 3);
    }, []);

    const handleRestart = useCallback(() => {
        resetGame();
        setCountdown((previous) => previous ?? 3);
    }, [resetGame]);

    useEffect(() => {
        const focusInput = (e: MouseEvent) => {
            // 只有當點擊的不是可輸入元素時才奪回焦點
            const target = e.target as HTMLElement;
            const isInteractive = target.closest('input, button, select, textarea, [contenteditable]');
            if (!isInteractive) {
                inputRef.current?.focus();
            }
        };
        inputRef.current?.focus();
        window.addEventListener('click', focusInput);
        return () => window.removeEventListener('click', focusInput);
    }, []);

    // Enter 快捷鍵開始 / 重製遊戲
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                if (status === 'idle' && countdown === null) {
                    handleStart();
                } else if (status === 'playing') {
                    handleRestart();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, countdown, handleStart, handleRestart]);

    // CapsLock & Language Conflict detection
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const caps = e.getModifierState('CapsLock');
            setCapsLockOn(caps);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 當語系警告或 CapsLock 警告出現時，執行重置
    useEffect(() => {
        if (capsLockOn && gameMode === 'English') {
            // CapsLock 開啟時不一定需要 resetIME，但可以作為防禦
        }
    }, [capsLockOn, gameMode]);

    // Timer & End Game Trigger
    useEffect(() => {
        if (status !== 'playing') return;

        // 檢查時間是否到了
        if (timeLeft === 0) {
            endGame();
            return;
        }

        const interval = setInterval(() => {
            tickTimer();
            setCurrentTime(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, [status, timeLeft, tickTimer, endGame]);

    // Generate new char on correct input
    useEffect(() => {
        if (inputCount > 0 && status === 'playing' && feedback === 'correct') {
            if (processedInputCount.current >= inputCount) return;
            processedInputCount.current = inputCount;
            const timer = setTimeout(() => {
                if (upcomingChars.length >= 2) {
                    setTargetChar(upcomingChars[0]);
                    setUpcomingChars([upcomingChars[1], generateChar()]);
                } else {
                    setTargetChar(generateChar());
                    setUpcomingChars([generateChar(), generateChar()]);
                }
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [inputCount, status, feedback, upcomingChars, generateChar, setTargetChar]);

    const startActualGame = useCallback(() => {
        startGame();
        const first = generateChar();
        const second = generateChar();
        const third = generateChar();
        setTargetChar(first);
        setUpcomingChars([second, third]);
        processedInputCount.current = 0;
        setCurrentTime(Date.now());
    }, [startGame, generateChar, setTargetChar]);

    useEffect(() => {
        if (countdown === null) return;
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
        const timer = setTimeout(() => {
            setCountdown(null);
            startActualGame();
        }, 0);
        return () => clearTimeout(timer);
    }, [countdown, startActualGame]);

    // Handle restart from ResultScreen
    useEffect(() => {
        if (wantsRestart && status === 'idle' && countdown === null) {
            const timer = setTimeout(() => {
                setWantsRestart(false);
                handleStart();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [wantsRestart, status, countdown, setWantsRestart, handleStart]);

    const accuracy = totalKeystrokes > 0 ? Math.round((score / totalKeystrokes) * 100) : 100;
    const displayTime = timeLeft === Infinity ? '∞' : timeLeft;

    const ppm =
        status === 'playing' && startTime > 0
            ? calculatePpm(score, startTime, currentTime)
            : 0;

    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[500px] relative">

            {/* CapsLock 警告 */}
            {capsLockOn && gameMode === 'English' && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-b-lg flex items-center gap-2 z-50 shadow-lg cursor-pointer"
                    onClick={resetIME}
                >
                    <AlertTriangle size={18} />
                    <span className="font-bold">CapsLock 已開啟 (點擊重置輸入)</span>
                </motion.div>
            )}

            {/* HUD */}
            <div className="w-full flex justify-center items-center mb-8 text-base font-mono border-b border-[var(--text-secondary)] pb-4">
                <div className="flex flex-col items-center gap-1">
                    <div className="text-sm opacity-50">剩餘時間</div>
                    <div className="text-5xl font-black tracking-widest">{displayTime}</div>
                </div>
            </div>

            {/* Mode Info */}
            <div className="text-sm opacity-50 mb-4">
                {gameMode === 'Zhuyin' ? '注音模式' : '英文模式'} •
                {gameMode === 'English' && (caseMode === 'lowercase' ? ' 小寫' : caseMode === 'uppercase' ? ' 大寫' : ' 混合')}
                {handMode !== 'all' && ` • ${handMode === 'left' ? '左手' : '右手'}區域`}
                {useCustomKeys && selectedKeys.length > 0 && ` • 自訂 ${selectedKeys.length} 鍵`}
            </div>

            {/* Main Target Display */}
            <div className="flex-1 flex items-center justify-center relative min-h-[180px] w-full">

                {countdown !== null && (
                    <div className="flex items-center justify-center">
                        <motion.div
                            key={countdown}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 1 }}
                            exit={{ scale: 2, opacity: 0 }}
                            className="text-[12rem] font-black filter drop-shadow-[0_0_20px_var(--accent)] text-[var(--accent)] z-50"
                        >
                            {countdown}
                        </motion.div>
                    </div>
                )}

                {status === 'idle' && countdown === null && (
                    <div className="flex items-center gap-12">
                        <div className="flex flex-col gap-4 text-right">
                            <div>
                                <div className="text-sm opacity-50">上局得分</div>
                                <div className="text-4xl font-black text-[var(--accent)]">{score}</div>
                            </div>
                            <div>
                                <div className="text-sm opacity-50">上局準確率</div>
                                <div className="text-4xl font-black">{accuracy}%</div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleStart}
                            className="px-16 py-6 bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-3xl rounded-full shadow-[0_0_30px_var(--accent)]"
                        >
                            開始訓練
                        </motion.button>
                    </div>
                )}

                {status === 'playing' && (
                    <>
                        <div className="absolute top-0 left-0 flex gap-6">
                            <div>
                                <div className="text-xs opacity-50">得分</div>
                                <div className="text-3xl font-black text-[var(--accent)]">{score}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-50">錯誤</div>
                                <div className="text-3xl font-black text-red-500">{errors}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-50">準確率</div>
                                <div className="text-3xl font-black">{accuracy}%</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-50">PPM</div>
                                <div className="text-3xl font-black text-blue-400">{ppm}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-9xl font-black filter drop-shadow-[0_0_20px_var(--accent)] text-[var(--accent)]">
                                {targetChar}
                            </div>

                            <div className="flex flex-col gap-1 border-l-2 border-[var(--text-secondary)]/30 pl-4">
                                {upcomingChars.map((char, i) => (
                                    <div
                                        key={`upcoming-${i}`}
                                        className={`font-bold text-[var(--text-primary)] ${i === 0 ? 'text-6xl opacity-70' : 'text-4xl opacity-40'
                                            }`}
                                    >
                                        {char}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <AnimatePresence>
                            {feedback === 'wrong' && (
                                <motion.div
                                    key={'wrong-' + inputCount}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute -bottom-4 text-[var(--error)] font-bold text-lg"
                                >
                                    錯誤！
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleRestart}
                            className="absolute top-0 right-0 p-2 opacity-50 hover:opacity-100 transition-opacity"
                            title="重新開始"
                        >
                            <RotateCcw size={28} />
                        </motion.button>
                    </>
                )}
            </div>

            <input
                ref={inputRef}
                type="text"
                onInput={(e) => {
                    const target = e.target as HTMLInputElement;
                    setTimeout(() => { target.value = ''; }, 0);
                }}
                onBlur={() => {
                    if (status === 'playing') {
                        setTimeout(() => inputRef.current?.focus(), 10);
                    }
                }}
                className="absolute -top-[9999px] -left-[9999px] w-px h-px opacity-0"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
            />

            <VirtualKeyboard />

            <div className="mt-6 text-sm opacity-50">
                {gameMode === 'Zhuyin'
                    ? '提示：請使用系統「注音輸入法」輸入對應的注音符號'
                    : '提示：直接按下對應的鍵盤按鍵'}
            </div>
        </div>
    );
};
