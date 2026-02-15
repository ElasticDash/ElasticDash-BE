export class SessionStore {
    constructor({ ttlMs = 3600000, cleanupIntervalMs = 300000 } = {}) {
        this.ttlMs = ttlMs;
        this.store = new Map();
        this.timer = setInterval(() => this.cleanup(), cleanupIntervalMs).unref();
    }

    set(key, value) {
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    delete(key) {
        this.store.delete(key);
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}

// Simple singleton for default usage
export const sessionStore = new SessionStore();
