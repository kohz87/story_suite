// Basics shared by the history replay parts: the record test, the error message and the failed-result test.

export function messageOf(error) {
    return error?.message ?? String(error);
}

export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function failedResult(result) {
    return result === false || result === null || result instanceof Error
        || (isRecord(result) && result.ok === false);
}
