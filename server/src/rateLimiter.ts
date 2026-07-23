interface Bucket {
    count: number;
    resetAt: number;
}

export class SocketRateLimiter {
    private readonly buckets = new Map<string, Bucket>();

    consume(socketId: string, event: string, limit: number, windowMs: number): boolean {
        const now = Date.now();
        const key = `${socketId}:${event}`;
        const current = this.buckets.get(key);

        if (!current || current.resetAt <= now) {
            this.buckets.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }

        if (current.count >= limit) return false;
        current.count += 1;
        return true;
    }

    clear(socketId: string): void {
        const prefix = `${socketId}:`;
        for (const key of this.buckets.keys()) {
            if (key.startsWith(prefix)) this.buckets.delete(key);
        }
    }
}
