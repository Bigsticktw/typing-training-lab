import type { GameConfig } from './types.js';

export const INPUT_LIMITS = {
    playerName: 24,
    roomName: 40,
    roomId: 16,
} as const;

const ALLOWED_MODES = new Set<GameConfig['mode']>(['English', 'Zhuyin']);
const ALLOWED_CASE_MODES = new Set<GameConfig['caseMode']>([
    'lowercase',
    'uppercase',
    'mixed',
]);
const ALLOWED_HAND_MODES = new Set<NonNullable<GameConfig['handMode']>>([
    'all',
    'left',
    'right',
]);

const readObject = (value: unknown, label: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label}格式錯誤`);
    }
    return value as Record<string, unknown>;
};

const readText = (value: unknown, label: string, maxLength: number): string => {
    if (typeof value !== 'string') throw new Error(`${label}格式錯誤`);
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) throw new Error(`${label}不可空白`);
    if (normalized.length > maxLength) throw new Error(`${label}過長`);
    return normalized;
};

export const validateGameConfig = (value: unknown): GameConfig => {
    const input = readObject(value, '遊戲設定');
    if (!ALLOWED_MODES.has(input.mode as GameConfig['mode'])) {
        throw new Error('不支援的遊戲模式');
    }
    if (!ALLOWED_CASE_MODES.has(input.caseMode as GameConfig['caseMode'])) {
        throw new Error('不支援的大小寫模式');
    }
    if (
        typeof input.duration !== 'number' ||
        !Number.isInteger(input.duration) ||
        input.duration < 15 ||
        input.duration > 300
    ) {
        throw new Error('遊戲時間必須是 15 到 300 秒的整數');
    }

    const config: GameConfig = {
        mode: input.mode as GameConfig['mode'],
        caseMode: input.caseMode as GameConfig['caseMode'],
        duration: input.duration,
    };

    if (input.handMode !== undefined) {
        if (!ALLOWED_HAND_MODES.has(input.handMode as NonNullable<GameConfig['handMode']>)) {
            throw new Error('不支援的單手模式');
        }
        config.handMode = input.handMode as NonNullable<GameConfig['handMode']>;
    }

    if (input.activeRows !== undefined) {
        if (
            !Array.isArray(input.activeRows) ||
            input.activeRows.some(
                row => typeof row !== 'number' || !Number.isInteger(row) || row < 1 || row > 4,
            )
        ) {
            throw new Error('鍵盤列必須是 1 到 4 的整數');
        }
        config.activeRows = [...new Set(input.activeRows as number[])].sort();
    }

    return config;
};

export const validateCreateRoom = (value: unknown) => {
    const input = readObject(value, '建立房間請求');
    return {
        name: readText(input.name, '房間名稱', INPUT_LIMITS.roomName),
        playerName: readText(input.playerName, '玩家名稱', INPUT_LIMITS.playerName),
        config: validateGameConfig(input.config),
    };
};

export const validateJoinRoom = (value: unknown) => {
    const input = readObject(value, '加入房間請求');
    return {
        roomId: readText(input.roomId, '房間代碼', INPUT_LIMITS.roomId).toUpperCase(),
        playerName: readText(input.playerName, '玩家名稱', INPUT_LIMITS.playerName),
    };
};

export const validateQuickMatch = (value: unknown) => {
    const input = readObject(value, '快速配對請求');
    return {
        playerName: readText(input.playerName, '玩家名稱', INPUT_LIMITS.playerName),
        config: validateGameConfig(input.config),
    };
};

export const validateGameInput = (value: unknown): { char: string } => {
    const input = readObject(value, '輸入請求');
    if (typeof input.char !== 'string' || [...input.char].length !== 1) {
        throw new Error('每次只能送出一個字元');
    }
    return { char: input.char };
};
