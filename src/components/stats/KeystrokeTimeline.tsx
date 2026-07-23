import { useMemo } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { type KeystrokeTiming } from '../../store/useGameStore';
import { KEYBOARD_LAYOUT } from '../../utils/layoutMaps';
import { type GameMode } from '../../store/useSettingsStore';

interface Props {
    keystrokeTimings: KeystrokeTiming[];
    startTime: number; // 遊戲開始時間戳
    gameMode: GameMode; // 使用記錄的模式，而非當前設定
}

export const KeystrokeTimeline = ({ keystrokeTimings, startTime, gameMode }: Props) => {

    // 向後相容:舊資料可能沒有 keystrokeTimings
    const chartData = useMemo(() => {
        return keystrokeTimings.map(timing => {
            // 優先使用儲存的字符（新資料），向後相容舊資料
            const display = timing.targetChar || (
                gameMode === 'English'
                    ? (KEYBOARD_LAYOUT.find(k => k.code === timing.targetKey)?.keyEn || timing.targetKey)
                    : (KEYBOARD_LAYOUT.find(k => k.code === timing.targetKey)?.keyZh || KEYBOARD_LAYOUT.find(k => k.code === timing.targetKey)?.keyEn || timing.targetKey)
            );

            // 轉換 pressedKey 從 keyCode 到可讀字符
            let displayPressedKey = timing.pressedKey;
            if (timing.pressedKey) {
                // 優先使用儲存的字符（新資料）
                displayPressedKey = timing.pressedChar || (
                    gameMode === 'English'
                        ? (KEYBOARD_LAYOUT.find(k => k.code === timing.pressedKey)?.keyEn || timing.pressedKey)
                        : (KEYBOARD_LAYOUT.find(k => k.code === timing.pressedKey)?.keyZh || KEYBOARD_LAYOUT.find(k => k.code === timing.pressedKey)?.keyEn || timing.pressedKey)
                );
            }

            return {
                time: ((timing.timestamp - startTime) / 1000).toFixed(2), // 轉換為秒
                latency: timing.latency,
                isCorrect: timing.isCorrect,
                key: display,
                targetKey: timing.targetKey,
                pressedKey: displayPressedKey
            };
        });
    }, [keystrokeTimings, startTime, gameMode]);

    if (chartData.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center bg-[var(--bg-primary)] rounded-lg opacity-30 text-sm">
                無按鍵記錄 (請進行新的訓練以生成時間軸數據)
            </div>
        );
    }

    return (
        <div className="w-full h-64 bg-[var(--bg-primary)] p-4 rounded-lg">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-secondary)" opacity={0.1} />
                    <XAxis
                        type="number"
                        dataKey="time"
                        name="時間"
                        unit="s"
                        stroke="var(--text-secondary)"
                        fontSize={10}
                        label={{ value: '時間 (秒)', position: 'bottom', fill: 'var(--text-secondary)', fontSize: 10 }}
                    />
                    <YAxis
                        type="number"
                        dataKey="latency"
                        name="延遲"
                        unit="ms"
                        stroke="var(--text-secondary)"
                        fontSize={10}
                        label={{ value: '延遲 (ms)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 10 }}
                    />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{
                            backgroundColor: 'var(--keyboard-bg)',
                            borderColor: 'var(--text-secondary)',
                            borderRadius: '8px',
                            fontSize: '11px'
                        }}
                        content={({ payload }) => {
                            if (!payload || payload.length === 0) return null;
                            const data = payload[0].payload;
                            return (
                                <div className="bg-[var(--keyboard-bg)] p-2 rounded-lg border border-[var(--text-secondary)]/20 shadow-xl">
                                    <div className="font-bold text-[var(--accent)] mb-1">
                                        按鍵: {data.key}
                                    </div>
                                    <div className="text-xs opacity-70">
                                        時間: {data.time}s
                                    </div>
                                    <div className="text-xs opacity-70">
                                        延遲: {data.latency}ms
                                    </div>
                                    {!data.isCorrect && data.pressedKey && (
                                        <div className="text-xs text-red-400 mt-1">
                                            ✗ 誤按: {data.pressedKey}
                                        </div>
                                    )}
                                </div>
                            );
                        }}
                    />
                    <Scatter name="按鍵" data={chartData}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.isCorrect ? 'var(--accent)' : '#ef4444'}
                                opacity={entry.isCorrect ? 0.7 : 0.9}
                            />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>

            <div className="flex justify-center gap-4 mt-2 text-[9px] opacity-50">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)]"></div>
                    <span>正確</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span>錯誤</span>
                </div>
            </div>
        </div>
    );
};
