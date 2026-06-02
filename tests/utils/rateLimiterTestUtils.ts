export interface MockClock {
    set(timeMs: number): void;
    advance(timeMs: number): void;
    restore(): void;
}

export function installMockClock(initialTimeMs = 0): MockClock {
    const originalNow = Date.now;
    let currentTimeMs = initialTimeMs;

    Date.now = () => currentTimeMs;

    return {
        set(timeMs: number) {
            currentTimeMs = timeMs;
        },
        advance(timeMs: number) {
            currentTimeMs += timeMs;
        },
        restore() {
            Date.now = originalNow;
        },
    };
}