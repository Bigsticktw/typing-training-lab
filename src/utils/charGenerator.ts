import { PRACTICABLE_KEYS, KEYBOARD_LAYOUT, LEFT_HAND_CODES, RIGHT_HAND_CODES } from './layoutMaps';
import type { GameMode, CaseMode, HandMode } from '../store/useSettingsStore';

export const getRandomChar = (
    mode: GameMode,
    caseMode: CaseMode,
    activeRows: number[],
    handMode: HandMode,
    selectedKeys?: string[], // 新增：自訂鍵位
    useCustomKeys?: boolean,
    keyStatistics?: { keyCount: Record<string, number>; keyErrors: Record<string, number> } // 新增：按鍵統計
): string => {
    let availableKeys = PRACTICABLE_KEYS;

    // 如果使用自訂鍵位
    if (useCustomKeys && selectedKeys && selectedKeys.length > 0) {
        availableKeys = PRACTICABLE_KEYS.filter(k => selectedKeys.includes(k.code));
    } else {
        // 否則使用行數 + 左右手過濾
        availableKeys = PRACTICABLE_KEYS.filter(k => activeRows.includes(k.row + 1));

        if (handMode === 'left') {
            availableKeys = availableKeys.filter(k => LEFT_HAND_CODES.includes(k.code));
        } else if (handMode === 'right') {
            availableKeys = availableKeys.filter(k => RIGHT_HAND_CODES.includes(k.code));
        }
    }

    // Fallback if nothing available
    if (availableKeys.length === 0) {
        return mode === 'English' ? 'a' : 'ㄅ';
    }

    // 使用加權隨機選擇
    let randomKey: typeof availableKeys[0];

    if (keyStatistics) {
        // 計算每個按鍵的權重
        const weights = availableKeys.map(key => {
            const count = keyStatistics.keyCount[key.code] || 0;
            const errors = keyStatistics.keyErrors[key.code] || 0;

            // 出題次數權重（反比，出現越少權重越高）
            const countWeight = 1 / (count + 1);

            // 錯誤率權重
            const errorRate = count > 0 ? errors / count : 0;
            const errorWeight = errorRate;

            // 總權重：出題次數權重 × 3 + 錯誤率權重 × 1
            return countWeight * 3 + errorWeight * 1;
        });

        // 計算總權重
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        // 輪盤賭算法（Roulette Wheel Selection）
        const random = Math.random() * totalWeight;
        let cumulativeWeight = 0;

        for (let i = 0; i < availableKeys.length; i++) {
            cumulativeWeight += weights[i];
            if (random <= cumulativeWeight) {
                randomKey = availableKeys[i];
                break;
            }
        }

        // Fallback（理論上不會到這裡）
        if (!randomKey!) {
            randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        }
    } else {
        // 沒有統計資料時，使用完全隨機
        randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    }

    if (mode === 'English') {
        const baseChar = randomKey.keyEn;

        // 處理字母鍵的大小寫
        if (/^[a-z]$/i.test(baseChar)) {
            switch (caseMode) {
                case 'lowercase':
                    return baseChar.toLowerCase();
                case 'uppercase':
                    return baseChar.toUpperCase();
                case 'mixed':
                    return Math.random() > 0.5 ? baseChar.toUpperCase() : baseChar.toLowerCase();
            }
        }

        // 處理有 Shift 組合的按鍵（數字和特殊符號）
        if (randomKey.keyShift && caseMode !== 'lowercase') {
            // 在 uppercase 模式下，優先使用 Shift 字符
            if (caseMode === 'uppercase') {
                return randomKey.keyShift;
            }
            // 在 mixed 模式下，隨機選擇基本字符或 Shift 字符
            if (caseMode === 'mixed') {
                return Math.random() > 0.5 ? randomKey.keyShift : baseChar;
            }
        }

        // 其他情況返回基本字符
        return baseChar;
    } else {
        // Zhuyin Mode
        return randomKey.keyZh || 'ㄅ';
    }
};

// 輔助函數：從字元取得 key code
export const getKeyCodeFromChar = (char: string, mode: GameMode): string | null => {
    const lowerChar = char.toLowerCase();

    if (mode === 'English') {
        const key = KEYBOARD_LAYOUT.find(k => k.keyEn.toLowerCase() === lowerChar);
        return key?.code || null;
    } else {
        // 注音模式：查找一般注音符號或標點符號
        const key = KEYBOARD_LAYOUT.find(k =>
            k.keyZh === char ||
            k.keyZhCtrl === char ||
            k.keyZhCtrlShift === char
        );
        return key?.code || null;
    }
};
