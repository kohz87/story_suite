// Guards a module's event listener (sdk.on(name, fn, { module })): with the isolatedApply flag on, a throw or a rejected promise becomes that module's Problem.

const MAX_REASON = 200;

const reasonOf = error => {
    const text = String(error?.message ?? error ?? '').replace(/\s+/g, ' ').trim();
    return text.length > MAX_REASON ? `${text.slice(0, MAX_REASON - 1)}…` : text;
};

/**
 * `guardListener(fn, { name, module, flag, report, problems, refresh })` → a listener with the same call shape.
 * Flag off (or no `module`): `fn` itself, so today's behaviour holds (the event bus logs a throw to the console; a returned promise is left alone).
 * Flag on: a sync throw or a rejected returned promise is logged and reported as { module, index, code: 'FAILED', message: '<event> failed: …' }, once
 * per (module, index, event) while that Problem is still listed; `refresh()` is asked for after a report so a card can show it.
 */
export function guardListener(fn, { name, module, flag = () => false, report = () => null, problems = () => [], refresh = null } = {}) {
    if (typeof module !== 'string' || module === '') return fn;
    const fail = (payload, error) => {
        console.warn(`[Story Suite] a "${name}" listener failed`, error);
        try {
            const index = Number.isInteger(payload?.index) ? payload.index : undefined;
            const message = `${name} failed: ${reasonOf(error)}`;
            const listed = problems(module) ?? [];
            if (listed.some(item => item.message === message && item.index === index && item.code === 'FAILED')) return;
            report({ module, ...(index === undefined ? {} : { index }), code: 'FAILED', message });
            refresh?.();
        } catch { /* reporting must never throw back into the event bus */ }
    };
    return function guarded(payload) {
        let on = false;
        try { on = flag() === true; } catch { on = false; }
        if (!on) return fn(payload);
        try {
            const out = fn(payload);
            if (typeof out?.then === 'function') out.then(undefined, error => fail(payload, error));
        } catch (error) { fail(payload, error); }
        return undefined;
    };
}
