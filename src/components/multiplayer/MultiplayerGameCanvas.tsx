import { useEffect, useRef, useState } from 'react';
import { useMultiplayerStore } from '../../store/useMultiplayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Zap, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { VirtualKeyboard } from '../keyboard/VirtualKeyboard';

// 音效播放
const playSound = (type: 'correct' | 'wrong') => {
    try {
        const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
        if (!AudioContextConstructor) return;
        const audioContext = new AudioContextConstructor();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'correct') {
            oscillator.frequency.value = 880; // A5
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } else {
            oscillator.frequency.value = 200; // Low buzz
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        }
    } catch {
        // 音效播放失敗時靜默處理
    }
};

export function MultiplayerGameCanvas() {
    const {
        charSequence,
        currentCharIndex,
        gameStartTime,
        roomPlayers,
        playerStats,
        playerId,
        sendInput,
        status,
        currentRoom,
    } = useMultiplayerStore();

    const { soundEnabled } = useSettingsStore();

    const inputRef = useRef<HTMLInputElement>(null);
    const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
    const [timeLeft, setTimeLeft] = useState(0);
    const [capsLockOn, setCapsLockOn] = useState(false);

    const currentChar = charSequence[currentCharIndex] || '';
    const nextChar = charSequence[currentCharIndex + 1] || '';
    const nextNextChar = charSequence[currentCharIndex + 2] || '';
    const myStats = playerId ? playerStats.get(playerId) : null;

    // 獲取遊戲設定
    const gameConfig = currentRoom?.gameConfig;
    const gameMode = gameConfig?.mode || 'English';
    const caseMode = gameConfig?.caseMode || 'lowercase';
    const duration = gameConfig?.duration || 60;

    // 計時器
    useEffect(() => {
        if (!gameStartTime || status !== 'playing') return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - gameStartTime;
            const remaining = Math.max(0, duration * 1000 - elapsed);
            setTimeLeft(Math.ceil(remaining / 1000));

            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [gameStartTime, status, duration]);

    // 輸入處理 - 修復 Shift 鍵誤判問題
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== 'playing' || !currentChar) return;

            // 檢查 CapsLock 狀態
            const caps = e.getModifierState('CapsLock');
            setCapsLockOn(caps);

            // 忽略修飾鍵和功能鍵
            if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape', 'Backspace', 'Enter'].includes(e.key)) {
                return;
            }

            e.preventDefault();

            const inputKey = e.key;
            const shiftPressed = e.shiftKey;
            const capsLockActive = e.getModifierState('CapsLock');

            let isCorrect = false;

            // 檢查是否為字母
            const isLetter = /^[a-zA-Z]$/.test(currentChar);

            if (isLetter) {
                const targetIsUpperCase = currentChar === currentChar.toUpperCase();
                const baseKey = currentChar.toLowerCase();
                const inputBaseKey = inputKey.toLowerCase();

                // 首先檢查按下的實體按鍵是否正確
                const correctPhysicalKey = inputBaseKey === baseKey;

                if (correctPhysicalKey) {
                    if (targetIsUpperCase) {
                        // 目標是大寫：需要 (Shift+按鍵) 或 (CapsLock開啟+按鍵且沒按Shift)
                        isCorrect = (shiftPressed && !capsLockActive) || (!shiftPressed && capsLockActive);
                    } else {
                        // 目標是小寫：需要 (沒按Shift且CapsLock關閉) 或 (按Shift且CapsLock開啟)
                        isCorrect = (!shiftPressed && !capsLockActive) || (shiftPressed && capsLockActive);
                    }
                }
            } else {
                // 非字母字符，直接比對
                isCorrect = inputKey === currentChar;
            }

            sendInput(inputKey);

            // 播放音效
            if (soundEnabled) {
                playSound(isCorrect ? 'correct' : 'wrong');
            }

            setFeedback(isCorrect ? 'correct' : 'wrong');
            setTimeout(() => setFeedback('idle'), 300);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, currentChar, sendInput, soundEnabled]);

    // 聚焦輸入框
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // 計算排名
    const rankings = roomPlayers
        .map(player => ({
            ...player,
            stats: playerStats.get(player.id),
        }))
        .sort((a, b) => (b.stats?.score ?? 0) - (a.stats?.score ?? 0));

    // 計算準確率
    const accuracy = myStats ?
        (myStats.score + myStats.errors > 0
            ? Math.round((myStats.score / (myStats.score + myStats.errors)) * 100)
            : 100)
        : 100;

    return (
        <div className="flex flex-col items-center justify-center p-4 w-full">
            {/* 隱藏輸入框 */}
            <input
                ref={inputRef}
                type="text"
                className="absolute opacity-0 pointer-events-none"
                autoFocus
            />

            {/* CapsLock 警告 */}
            {capsLockOn && gameMode === 'English' && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 z-50 shadow-lg"
                >
                    <AlertTriangle size={18} />
                    <span className="font-bold">CapsLock 已開啟</span>
                </motion.div>
            )}

            {/* 遊戲設定顯示 */}
            <div className="w-full max-w-6xl mb-4 text-center">
                <div className="text-sm opacity-50">
                    {gameMode === 'Zhuyin' ? '注音模式' : '英文模式'} •
                    {gameMode === 'English' && (caseMode === 'lowercase' ? ' 小寫' : caseMode === 'uppercase' ? ' 大寫' : ' 混合')} •
                    {duration}秒
                </div>
            </div>

            {/* 頂部資訊列 */}
            <div className="w-full max-w-6xl mb-6 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="text-center">
                        <div className="text-sm opacity-50">時間</div>
                        <div className="text-3xl font-bold font-mono">{timeLeft}s</div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm opacity-50">分數</div>
                        <div className="text-3xl font-bold font-mono text-[var(--accent)]">
                            {myStats?.score ?? 0}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm opacity-50">錯誤</div>
                        <div className="text-3xl font-bold font-mono text-red-500">
                            {myStats?.errors ?? 0}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm opacity-50">準確率</div>
                        <div className="text-3xl font-bold font-mono">
                            {accuracy}%
                        </div>
                    </div>
                </div>

                {/* 排名顯示 */}
                <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={24} />
                    <span className="text-sm opacity-50">排名:</span>
                    <span className="text-2xl font-bold">
                        #{rankings.findIndex(r => r.id === playerId) + 1}
                    </span>
                </div>
            </div>

            {/* 字符顯示區 - 包含預覽字元 */}
            <div className="mb-6 flex items-center gap-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentCharIndex}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        className={clsx(
                            "text-9xl font-bold font-mono select-none transition-all duration-200 filter drop-shadow-[0_0_20px_var(--accent)]",
                            feedback === 'correct' && "text-green-500",
                            feedback === 'wrong' && "text-red-500 animate-shake",
                            feedback === 'idle' && "text-[var(--accent)]"
                        )}
                    >
                        {currentChar || '—'}
                    </motion.div>
                </AnimatePresence>

                {/* 預覽後兩個字元 */}
                <div className="flex flex-col gap-1 border-l-2 border-[var(--text-secondary)]/30 pl-4">
                    <div className="text-6xl font-bold text-[var(--text-primary)] opacity-70">
                        {nextChar}
                    </div>
                    <div className="text-4xl font-bold text-[var(--text-primary)] opacity-40">
                        {nextNextChar}
                    </div>
                </div>
            </div>

            {/* 錯誤提示 */}
            <AnimatePresence>
                {feedback === 'wrong' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-red-500 font-bold text-lg mb-4"
                    >
                        錯誤！
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 玩家排行榜 */}
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {rankings.map((player, index) => (
                    <div
                        key={player.id}
                        className={clsx(
                            "bg-[var(--keyboard-bg)] p-4 rounded-xl border-2 transition-all",
                            player.id === playerId
                                ? "border-[var(--accent)] shadow-[0_0_15px_var(--accent)]/50"
                                : "border-transparent",
                            index === 0 && "ring-2 ring-yellow-500/50"
                        )}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {index === 0 && <Trophy className="text-yellow-500" size={16} />}
                                <span className="font-bold">{player.name}</span>
                            </div>
                            <span className="text-sm opacity-50">#{index + 1}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-1">
                                <Target size={14} className="text-green-500" />
                                {player.stats?.score ?? 0}
                            </span>
                            <span className="flex items-center gap-1">
                                <Zap size={14} className="text-red-500" />
                                {player.stats?.errors ?? 0}
                            </span>
                        </div>
                        {/* 進度條 */}
                        <div className="mt-2 h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[var(--accent)] transition-all duration-300"
                                style={{
                                    width: `${Math.min(100, ((player.stats?.currentIndex ?? 0) / charSequence.length) * 100)}%`
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* 虛擬鍵盤 */}
            <VirtualKeyboard />

            {/* 提示 */}
            <div className="mt-4 text-sm opacity-50">
                {gameMode === 'Zhuyin'
                    ? '提示：請使用系統「注音輸入法」輸入對應的注音符號'
                    : '提示：直接按下對應的鍵盤按鍵'}
            </div>
        </div>
    );
}
