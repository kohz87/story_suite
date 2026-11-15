// The interpreter's error type and the helper that throws it.
export class DataModuleError extends Error {
    constructor(code, path, message) { super(message); this.code = code; this.path = path; }
}
export const refuse = (code, path, message) => { throw new DataModuleError(code, path, message); };
