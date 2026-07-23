export const calculateAccuracy = (correct: number, total: number): number => {
    if (total <= 0) return 0;
    return Math.round((Math.max(0, correct) / total) * 100);
};

export const calculatePpm = (
    correct: number,
    startedAt: number,
    endedAt: number,
): number => {
    const elapsedMs = Math.max(0, endedAt - startedAt);
    if (elapsedMs === 0) return 0;
    return Math.round(Math.max(0, correct) / (elapsedMs / 60000));
};

export const calculateAverageLatency = (
    keyLatencies: Record<string, number[]>,
): number => {
    const values = Object.values(keyLatencies)
        .flat()
        .filter((latency) => Number.isFinite(latency) && latency >= 0);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, latency) => sum + latency, 0) / values.length);
};
