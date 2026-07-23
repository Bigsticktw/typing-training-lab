import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';

export const SoundManager = () => {
    const { feedback, status, inputCount } = useGameStore();
    const { soundEnabled, volume } = useSettingsStore();

    // Keep track of last input count to trigger on each input
    const prevInputCount = useRef(inputCount);
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        // Initialize AudioContext on first user interaction or mount?
        // Browsers block AudioContext until user gesture. 
        // We assume interaction happened (Start Game button).
        if (!audioCtxRef.current) {
            const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
            if (AudioContextConstructor) {
                audioCtxRef.current = new AudioContextConstructor();
            }
        }
    }, [status]); // Try init on status change (e.g. playing)

    useEffect(() => {
        if (!soundEnabled) return;
        if (feedback === 'idle') return;

        // Only play sound if inputCount has changed (new input)
        if (inputCount === prevInputCount.current) {
            return;
        }

        // Play Sound
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (feedback === 'correct') {
            // High ping
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (feedback === 'wrong') {
            // Low buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }

        prevInputCount.current = inputCount;
    }, [inputCount, feedback, soundEnabled, volume]);

    return null; // Logic only
};
