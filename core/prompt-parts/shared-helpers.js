// Story Suite v2: the token estimate and the guarded call that the prompt parts share.

/** Tokens in `text`, estimated at four characters each. */
export const estimateTokens = text => Math.ceil(String(text ?? '').length / 4);

export function attempt(fn, fallback, problems, what) {
    try { return fn(); } catch (error) {
        problems.push(`${what} failed: ${error?.message ?? error}`);
        return fallback;
    }
}
