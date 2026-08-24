import { useSettingsStore, type GameMode, type Theme, type CaseMode, type HandMode } from '../../store/useSettingsStore';
import { useGameStore } from '../../store/useGameStore';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { isValidPersonalSheetsToken, loadPersonalSheetsToken, savePersonalSheetsToken } from '../../services/PersonalSheetsConfig';

export const SettingsPanel = () => {
    const {
        gameMode, setGameMode,
        caseMode, setCaseMode,
        theme, setTheme,
        timeMode, setTimeMode,
        activeRows, toggleRow,
        handMode, setHandMode,
        soundEnabled, setSoundEnabled,
        volume, setVolume,
        selectedKeys, selectKeysFromString, clearAllKeys, selectAllKeys, useCustomKeys
    } = useSettingsStore();

    const { status } = useGameStore();
    const [customTime, setCustomTime] = useState('');
    const [keyString, setKeyString] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [personalToken, setPersonalToken] = useState(loadPersonalSheetsToken);
    const [tokenSaved, setTokenSaved] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const themeRef = useRef<HTMLDivElement>(null);

    const handleCustomTime = () => {
        const parsed = parseInt(customTime);
        if (parsed > 0 && parsed <= 3600) {
            setTimeMode(parsed);
        }
    };

    const handleKeyStringApply = () => {
        if (keyString.trim()) {
            selectKeysFromString(keyString);
        }
    };

    const handlePersonalTokenSave = () => {
        if (!isValidPersonalSheetsToken(personalToken)) return;
        setPersonalToken(savePersonalSheetsToken(personalToken));
        setTokenSaved(true);
        window.setTimeout(() => setTokenSaved(false), 2_000);
    };

    // 點擊外部收起
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setShowAdvanced(false);
            }
            if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
                setShowThemeMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isDisabled = status === 'playing';

    return (
        <div
            ref={panelRef}
            className="absolute top-4 right-4 flex flex-col gap-3 text-sm font-mono z-[100] max-w-xl"
        >

            {/* 主要控制列 */}
            <div className="flex flex-wrap gap-2 justify-end">

                {/* 模式切換 */}
                <div className="flex bg-[var(--keyboard-bg)] rounded-xl p-1 shadow-lg border border-[var(--text-secondary)]/10">
                    {(['English', 'Zhuyin'] as GameMode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setGameMode(m)}
                            disabled={isDisabled}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${gameMode === m
                                ? 'bg-[var(--accent)] text-[var(--bg-primary)] shadow-md'
                                : 'opacity-50 hover:opacity-80'}`}
                        >
                            {m === 'English' ? 'EN' : 'ㄅ'}
                        </button>
                    ))}
                </div>

                {/* 時間 */}
                <div className="flex bg-[var(--keyboard-bg)] rounded-xl p-1 shadow-lg border border-[var(--text-secondary)]/10">
                    {([15, 30, 60, 'infinite'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTimeMode(t)}
                            disabled={isDisabled}
                            className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${timeMode === t
                                ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                                : 'opacity-50 hover:opacity-80'}`}
                        >
                            {t === 'infinite' ? '∞' : t}
                        </button>
                    ))}
                </div>

                {/* 主題切換 (自訂 Dropdown) */}
                <div className="relative" ref={themeRef}>
                    <button
                        onClick={() => setShowThemeMenu(!showThemeMenu)}
                        disabled={isDisabled}
                        className="flex items-center gap-2 bg-[var(--keyboard-bg)] text-[var(--text-primary)] border border-[var(--text-secondary)]/10 rounded-xl px-4 py-1.5 text-xs font-bold shadow-lg transition-all hover:border-[var(--accent)]/30 min-w-[80px] justify-between"
                    >
                        <span>{theme === 'cyber' ? '極簡' : theme === 'paper' ? '紙張' : theme === 'retro' ? '復古' : '霓虹'}</span>
                        <ChevronDown size={14} className={clsx("transition-transform duration-200", { "rotate-180": showThemeMenu })} />
                    </button>

                    <AnimatePresence>
                        {showThemeMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                className="absolute right-0 mt-2 py-1 bg-[var(--keyboard-bg)] border border-[var(--text-secondary)]/20 rounded-xl shadow-2xl z-[110] min-w-[100px] backdrop-blur-md overflow-hidden"
                            >
                                {(['cyber', 'paper', 'retro', 'neon'] as Theme[]).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setTheme(t);
                                            setShowThemeMenu(false);
                                        }}
                                        className={clsx(
                                            "w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center justify-between group",
                                            theme === t ? "text-[var(--accent)] bg-[var(--accent)]/5" : "opacity-60 hover:opacity-100 hover:bg-[var(--accent)]/10"
                                        )}
                                    >
                                        {t === 'cyber' ? '極簡' : t === 'paper' ? '紙張' : t === 'retro' ? '復古' : '霓虹'}
                                        {theme === t && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 進階選單按鈕 */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`flex items-center gap-2 px-4 py-1.5 bg-[var(--keyboard-bg)] rounded-xl text-xs font-bold shadow-lg border border-[var(--text-secondary)]/10 transition-all ${showAdvanced ? 'text-[var(--accent)] border-[var(--accent)]/50' : 'opacity-70'}`}
                >
                    <Settings size={14} className={showAdvanced ? 'animate-spin-slow' : ''} />
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* 進階面板 */}
            {showAdvanced && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-[var(--keyboard-bg)] rounded-2xl p-5 flex flex-col gap-4 text-xs shadow-2xl border border-[var(--accent)]/20 backdrop-blur-md"
                >
                    {/* 大小寫控制 (注音鎖定) */}
                    <div className="flex flex-col gap-2">
                        <span className="opacity-50 text-[10px] uppercase font-black">大小寫模式 {gameMode === 'Zhuyin' && '(注音不可用)'}</span>
                        <div className={`flex bg-[var(--bg-primary)] rounded-xl p-1 ${gameMode === 'Zhuyin' ? 'opacity-30 grayscale' : ''}`}>
                            {([['lowercase', '小寫'], ['uppercase', '大寫'], ['mixed', '混合']] as [CaseMode, string][]).map(([c, label]) => (
                                <button
                                    key={c}
                                    onClick={() => gameMode !== 'Zhuyin' && setCaseMode(c)}
                                    disabled={isDisabled || gameMode === 'Zhuyin'}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${caseMode === c && gameMode === 'English'
                                        ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                                        : 'opacity-50 hover:opacity-80'} ${gameMode === 'Zhuyin' ? 'cursor-not-allowed' : ''}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 字串選鍵 (注音鎖定) */}
                    <div className="flex flex-col gap-2">
                        <span className="opacity-50 text-[10px] uppercase font-black">字串選鍵 {gameMode === 'Zhuyin' && '(僅支援英文)'}</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={keyString}
                                onChange={(e) => setKeyString(e.target.value)}
                                placeholder={gameMode === 'Zhuyin' ? "注音模式不可用" : "輸入字串如: javascript"}
                                className={`flex-1 px-3 py-2 bg-[var(--bg-primary)] rounded-xl text-xs outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition-all ${gameMode === 'Zhuyin' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                disabled={isDisabled || gameMode === 'Zhuyin'}
                            />
                            <button
                                onClick={handleKeyStringApply}
                                disabled={isDisabled || !keyString.trim() || gameMode === 'Zhuyin'}
                                className="px-4 py-2 bg-[var(--accent)] text-[var(--bg-primary)] rounded-xl font-bold shadow-lg disabled:opacity-30 transition-all active:scale-95"
                            >
                                套用
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="opacity-50 text-[10px] uppercase font-black">自訂時間 (秒)</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={customTime}
                                onChange={(e) => setCustomTime(e.target.value)}
                                placeholder="秒"
                                className="w-16 px-2 py-1 bg-[var(--bg-primary)] rounded-lg text-center text-xs outline-none"
                                min={1}
                                max={3600}
                                disabled={isDisabled}
                            />
                            <button
                                onClick={handleCustomTime}
                                disabled={isDisabled}
                                className="px-2 py-1 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg font-bold text-[10px]"
                            >
                                套用
                            </button>
                        </div>
                    </div>

                    <div className="w-full h-px bg-[var(--text-secondary)]/5 my-1" />

                    {/* 行數 */}
                    <div className="flex items-center justify-between">
                        <span className="opacity-50 text-[10px] uppercase font-black">練習行數</span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4].map(row => (
                                <button
                                    key={row}
                                    onClick={() => toggleRow(row)}
                                    disabled={isDisabled}
                                    className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${activeRows.includes(row)
                                        ? 'bg-[var(--accent)] text-[var(--bg-primary)] shadow-md'
                                        : 'bg-[var(--bg-primary)] opacity-40 hover:opacity-70'}`}
                                >
                                    {row}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 區域 */}
                    <div className="flex items-center justify-between">
                        <span className="opacity-50 text-[10px] uppercase font-black">區域</span>
                        <div className="flex bg-[var(--bg-primary)] rounded-xl p-1">
                            {([['all', '全'], ['left', '左'], ['right', '右']] as [HandMode, string][]).map(([h, label]) => (
                                <button
                                    key={h}
                                    onClick={() => setHandMode(h)}
                                    disabled={isDisabled}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${handMode === h
                                        ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                                        : 'opacity-40 hover:opacity-70'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 其他控制 */}
                    <div className="flex items-center justify-between">
                        <span className="opacity-50 text-[10px] uppercase font-black">鍵位操作</span>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAllKeys}
                                disabled={isDisabled}
                                className="px-3 py-1.5 bg-[var(--bg-primary)] rounded-lg text-[10px] font-bold opacity-60 hover:opacity-100 hover:text-[var(--accent)] transition-all"
                            >
                                全選
                            </button>
                            <button
                                onClick={clearAllKeys}
                                disabled={isDisabled}
                                className="px-3 py-1.5 bg-[var(--bg-primary)] rounded-lg text-[10px] font-bold opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                            >
                                清除
                            </button>
                        </div>
                    </div>

                    {/* 音量 */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="opacity-50 text-[10px] uppercase font-black">打字音效</span>
                            <span className="text-[10px] font-mono opacity-50">{Math.round(volume * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={soundEnabled}
                                onChange={(e) => setSoundEnabled(e.target.checked)}
                                className="w-4 h-4 rounded border-none bg-[var(--bg-primary)] accent-[var(--accent)] cursor-pointer"
                            />
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.1}
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="flex-1 accent-[var(--accent)] h-1 bg-[var(--bg-primary)] rounded-full appearance-none cursor-pointer"
                                disabled={!soundEnabled}
                            />
                        </div>
                    </div>

                    <div className="w-full h-px bg-[var(--text-secondary)]/5 my-1" />

                    <div className="flex flex-col gap-2">
                        <span className="opacity-50 text-[10px] uppercase font-black">私人 Google Sheet（選填）</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="password"
                                value={personalToken}
                                onChange={(event) => { setPersonalToken(event.target.value); setTokenSaved(false); }}
                                placeholder="貼上你的私人 Token"
                                autoComplete="off"
                                className="flex-1 px-3 py-2 bg-[var(--bg-primary)] rounded-xl text-xs outline-none focus:ring-1 focus:ring-[var(--accent)]/50"
                                disabled={isDisabled}
                            />
                            <button
                                type="button"
                                onClick={handlePersonalTokenSave}
                                disabled={isDisabled || !isValidPersonalSheetsToken(personalToken)}
                                className="px-4 py-2 bg-[var(--accent)] text-[var(--bg-primary)] rounded-xl font-bold disabled:opacity-30"
                            >
                                {tokenSaved ? '已儲存' : '儲存'}
                            </button>
                        </div>
                        <p className="text-[10px] opacity-50 leading-relaxed">
                            留空會匿名加入公開統計，且訓練結果不顯示同步訊息。公開統計只保存國家代碼與不可逆 IP 雜湊，不保存完整 IP。
                        </p>
                    </div>

                    {useCustomKeys && (
                        <div className="text-[10px] text-center text-[var(--accent)] font-bold animate-pulse">
                            目前使用自訂 {selectedKeys.length} 鍵
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
};
