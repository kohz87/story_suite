// Story Director v2, chronicle part: reads the Director's clock in story minutes from a command context.

const isInt = value => Number.isSafeInteger(value);

/**
 * The Director's clock now, in story minutes, or null while it is not set: Story Block's
 * `ctx.time()` (SPEC §3.2), else the tracker's `director.time` query, else `director.time.minutes`.
 */
export function clockOf(ctx) {
    const tries = [
        () => (typeof ctx?.time === 'function' ? ctx.time() : undefined),
        () => (typeof ctx?.query === 'function' ? ctx.query('director.time', {})?.minutes : undefined),
        () => (typeof ctx?.read === 'function' ? ctx.read('director')?.time?.minutes : undefined),
    ];
    for (const fn of tries) {
        let value;
        try { value = fn(); } catch { value = undefined; }
        if (isInt(value)) return value;
    }
    return null;
}
