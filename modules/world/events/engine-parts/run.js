// Pack events, the engine: checks the due events before each reply and commits them one after another through the command bus.

import { FIRE } from './shared-keys.js';
import { inspect } from './inspect.js';

const isThenable = value => value !== null && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';

/** Run `steps` in order; synchronous while every result is, a promise from the first that is not. */
function sequence(steps, onResult) {
    for (let index = 0; index < steps.length; index += 1) {
        let result;
        try {
            result = steps[index]();
        } catch (error) {
            result = { ok: false, code: 'FAILED', message: error?.message ?? String(error) };
        }
        if (isThenable(result)) {
            return Promise.resolve(result)
                .catch(error => ({ ok: false, code: 'FAILED', message: error?.message ?? String(error) }))
                .then(value => {
                    onResult(index, value);
                    return sequence(steps.slice(index + 1), (rest, next) => onResult(index + 1 + rest, next));
                });
        }
        onResult(index, result);
    }
    return undefined;
}

/**
 * The engine around injected dependencies:
 *   events(view) → event definitions from the enabled packs
 *   command(type, payload, { cause }) → { ok, receipt } | { ok: false, code, message } (or a promise of it)
 *   query(name, args) → for `status(state)` outside a beforeGenerate view
 */
export function createEngine({ events, command, query } = {}) {
    let lastRun = { fired: [], failed: [] };

    function read(view) {
        try {
            const list = typeof events === 'function' ? events(view) : [];
            if (isThenable(list)) return { list: [], problems: ['The event list answered later; events are read synchronously.'] };
            return { list: Array.isArray(list) ? list : [], problems: [] };
        } catch (error) {
            return { list: [], problems: [`The event list could not be read: ${error?.message ?? String(error)}`] };
        }
    }

    function report(view) {
        const { list, problems } = read(view);
        return inspect(view, list, problems);
    }

    /**
     * SPEC §4.1 step 3. Commits the due events; returns nothing for the tail (or a promise of nothing).
     * `info.type` is the generation's ('normal', 'swipe', …): a swipe writes the last message again.
     */
    function beforeGenerate(view, info = {}) {
        const result = report(view);
        const dueIds = new Set(result.due);
        const due = result.defs.filter(def => dueIds.has(def.id));
        // A Continue or a dry run commits nothing (turn.js says so with commit: false).
        if (info?.commit === false || info?.dryRun === true || info?.type === 'continue') return undefined;
        const run = { fired: [], failed: [] };
        lastRun = run;
        if (!due.length) return undefined;
        if (typeof command !== 'function') {
            run.failed = due.map(def => ({ id: def.id, code: 'FAILED', message: 'There is no command bus to commit events through.' }));
            return undefined;
        }
        const length = Number.isInteger(view?.chat?.length) ? view.chat.length : null;
        const at = length === null ? null : info?.type === 'swipe' || info?.type === 'continue' ? length - 1 : length;
        const steps = due.map(def => () => command(FIRE, { id: def.id, ...(at === null ? {} : { at }) }, { cause: 'system' }));
        const done = sequence(steps, (index, result) => {
            const { id } = due[index];
            if (result?.ok) run.fired.push(id);
            else run.failed.push({ id, code: result?.code ?? 'FAILED', message: result?.message ?? 'The command gave no answer.' });
        });
        return isThenable(done) ? done.then(() => undefined) : undefined;
    }

    /** The `events.status` query: where each event stands, plus what the last beforeGenerate did. */
    function status(state, view = null) {
        const { defs, ...rest } = report(view ?? { state, query });
        return { ...rest, lastRun: { fired: [...lastRun.fired], failed: lastRun.failed.map(entry => ({ ...entry })) } };
    }

    return { beforeGenerate, status, report };
}
