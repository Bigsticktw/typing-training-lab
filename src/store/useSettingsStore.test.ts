// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

describe('settings store', () => {
    beforeEach(() => {
        localStorage.clear();
        useSettingsStore.setState({
            gameMode: 'English',
            caseMode: 'mixed',
            timeMode: 60,
            theme: 'cyber',
            activeRows: [2, 3, 4],
            handMode: 'all',
            soundEnabled: true,
            volume: 0.5,
            selectedKeys: [],
            useCustomKeys: false,
        });
    });

    it('enables and disables custom key training', () => {
        useSettingsStore.getState().toggleKey('KeyA');
        expect(useSettingsStore.getState().selectedKeys).toEqual(['KeyA']);
        expect(useSettingsStore.getState().useCustomKeys).toBe(true);

        useSettingsStore.getState().toggleKey('KeyA');
        expect(useSettingsStore.getState().selectedKeys).toEqual([]);
        expect(useSettingsStore.getState().useCustomKeys).toBe(false);
    });

    it('maps pasted characters and removes duplicates', () => {
        useSettingsStore.getState().selectKeysFromString('aAb');
        expect(useSettingsStore.getState().selectedKeys).toEqual(['KeyA', 'KeyB']);
    });

    it('clears custom keys when hand mode changes', () => {
        useSettingsStore.getState().setSelectedKeys(['KeyA', 'KeyB']);
        useSettingsStore.getState().setHandMode('left');

        expect(useSettingsStore.getState().handMode).toBe('left');
        expect(useSettingsStore.getState().selectedKeys).toEqual([]);
        expect(useSettingsStore.getState().useCustomKeys).toBe(false);
    });
});
