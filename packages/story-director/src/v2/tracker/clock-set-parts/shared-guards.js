// Story Director v2, tracker part: the integer and record tests and the refusal the clock parts share.

export const isInt = value => Number.isSafeInteger(value);
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function fail(ctx, code, message) {
    ctx.fail(code, message);
    // ctx.fail throws; this is only for a ctx that does not.
    const error = new Error(message);
    error.code = code;
    throw error;
}
