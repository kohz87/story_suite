// Command errors: CommandError, fail, asCommandError and the isRecord check.
/** The error `ctx.fail` throws; the bus turns it into { ok: false, code, message }. */
export class CommandError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'CommandError';
        this.code = code;
    }
}

export function fail(code, message) {
    throw new CommandError(code, message);
}

export function asCommandError(type, error) {
    if (error instanceof CommandError) return error;
    return new CommandError('FAILED', `Something went wrong in ${type}: ${error?.message ?? String(error)}`);
}

export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
