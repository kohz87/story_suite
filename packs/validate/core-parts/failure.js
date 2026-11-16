// The job: the failure result every pack check returns.

export function fail(code, path, message) {
    return { ok: false, errors: [{ code, path, message }] };
}
