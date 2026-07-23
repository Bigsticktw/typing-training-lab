import type { GameConfig } from '../types.js';

type Hand = 'left' | 'right';

interface TrainingKey {
    row: number;
    hand: Hand;
    english: string;
    zhuyin: string;
}

const TRAINING_KEYS: TrainingKey[] = [
    { row: 1, hand: 'left', english: '1', zhuyin: 'ㄅ' },
    { row: 1, hand: 'left', english: '2', zhuyin: 'ㄉ' },
    { row: 1, hand: 'left', english: '3', zhuyin: 'ˇ' },
    { row: 1, hand: 'left', english: '4', zhuyin: 'ˋ' },
    { row: 1, hand: 'left', english: '5', zhuyin: 'ㄓ' },
    { row: 1, hand: 'right', english: '6', zhuyin: 'ˊ' },
    { row: 1, hand: 'right', english: '7', zhuyin: '˙' },
    { row: 1, hand: 'right', english: '8', zhuyin: 'ㄚ' },
    { row: 1, hand: 'right', english: '9', zhuyin: 'ㄞ' },
    { row: 1, hand: 'right', english: '0', zhuyin: 'ㄢ' },
    { row: 1, hand: 'right', english: '-', zhuyin: 'ㄦ' },
    ...makeRow(2, 'qwert', 'yuiop', 'ㄆㄊㄍㄐㄔ', 'ㄗㄧㄛㄟㄣ'),
    ...makeRow(3, 'asdfg', 'hjkl;', 'ㄇㄋㄎㄑㄕ', 'ㄘㄨㄜㄠㄤ'),
    ...makeRow(4, 'zxcvb', 'nm,./', 'ㄈㄌㄏㄒㄖ', 'ㄙㄩㄝㄡㄥ'),
];

function makeRow(
    row: number,
    leftEnglish: string,
    rightEnglish: string,
    leftZhuyin: string,
    rightZhuyin: string,
): TrainingKey[] {
    const createKeys = (english: string, zhuyin: string, hand: Hand): TrainingKey[] =>
        [...english].map((character, index) => ({
            row,
            hand,
            english: character,
            zhuyin: [...zhuyin][index],
        }));
    return [
        ...createKeys(leftEnglish, leftZhuyin, 'left'),
        ...createKeys(rightEnglish, rightZhuyin, 'right'),
    ];
}

export function generateCharSequence(config: GameConfig, count = 100): string[] {
    const activeRows = config.activeRows?.length ? config.activeRows : [1, 2, 3, 4];
    const handMode = config.handMode ?? 'all';
    const filtered = TRAINING_KEYS.filter(key =>
        activeRows.includes(key.row) &&
        (handMode === 'all' || key.hand === handMode),
    );
    const pool = filtered.length > 0 ? filtered : TRAINING_KEYS;
    const sequence: string[] = [];

    for (let index = 0; index < Math.max(0, count); index += 1) {
        const key = pool[Math.floor(Math.random() * pool.length)];
        if (config.mode === 'Zhuyin') {
            sequence.push(key.zhuyin);
            continue;
        }

        if (config.caseMode === 'uppercase') {
            sequence.push(key.english.toUpperCase());
        } else if (config.caseMode === 'mixed' && Math.random() >= 0.5) {
            sequence.push(key.english.toUpperCase());
        } else {
            sequence.push(key.english.toLowerCase());
        }
    }

    return sequence;
}
