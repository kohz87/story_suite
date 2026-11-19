// The sidecar write's retry timing: the retry delays, the durability cap, which errors are worth another try, and the wait between tries.

export const NPC_STATE_WRITE_RETRY_DELAYS_MS = Object.freeze([0, 1000, 2000, 5000, 15000, 30000]);

export const NPC_STATE_DURABILITY_RETRY_CAP_MS = 30000;

export function retryableWriteError(error) {
    if (['NPC_STATE_WRITE_CONFLICT', 'NPC_STATE_WRITE_CANCELLED', 'NPC_STATE_UNSUPPORTED_FORMAT'].includes(error?.code)) return false;
    if (error?.code === 'NPC_STATE_LOCK_TIMEOUT') return true;
    const status = Number(error?.status || 0);
    if ([408, 425, 429].includes(status) || status >= 500) return true;
    // The wrapper says 'write failed' for every response. Do not let that wording
    // turn authentication, permission, validation or size rejection into endless retries.
    if (status >= 400 && status < 500) return false;
    return !status || /network|fetch|timeout|temporar|unavailable|failed/i.test(String(error?.message || error));
}

export function wait(ms, sleepFn = globalThis.setTimeout) {
    return new Promise(resolve => sleepFn(resolve, Math.max(0, Number(ms) || 0)));
}
