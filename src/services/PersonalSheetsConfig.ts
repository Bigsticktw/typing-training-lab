const PERSONAL_TOKEN_STORAGE_KEY = 'typing-personal-sheets-token-v1';

export const loadPersonalSheetsToken = () => {
    try {
        return localStorage.getItem(PERSONAL_TOKEN_STORAGE_KEY)?.trim() ?? '';
    } catch {
        return '';
    }
};

export const savePersonalSheetsToken = (token: string) => {
    const normalized = token.trim();
    if (normalized) {
        localStorage.setItem(PERSONAL_TOKEN_STORAGE_KEY, normalized);
    } else {
        localStorage.removeItem(PERSONAL_TOKEN_STORAGE_KEY);
    }
    return normalized;
};

export const isValidPersonalSheetsToken = (token: string) => {
    const normalized = token.trim();
    return normalized.length === 0 || (normalized.length >= 24 && normalized.length <= 256);
};
