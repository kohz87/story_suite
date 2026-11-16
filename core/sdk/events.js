// The public sdk's event bus: named events, listeners, and a failing listener logged rather than thrown.

import { EVENTS } from './constants.js';
import { FLAGS } from '../runtime/flags.js';
import { guardListener } from './listener-guard.js';

const FLAG = FLAGS.isolatedApply;

/**
 * { on(name, fn, { module }?) → off, emit(name, payload) }; a listener that throws is logged, not passed on. `guard` ({ flag, report, problems, refresh },
 * all read late) turns a listener given a `module` into a guarded one (listener-guard.js).
 */
export function createEvents(guard = {}) {
    const listeners = new Map(EVENTS.map(name => [name, new Set()]));
    const known = name => {
        if (!listeners.has(name)) throw new Error(`Story Suite: there is no "${name}" event (known: ${EVENTS.join(', ')}).`);
        return listeners.get(name);
    };
    return {
        on(name, fn, opts) {
            if (typeof fn !== 'function') throw new Error('Story Suite: on() needs a function.');
            const set = known(name);
            const listener = typeof opts?.module === 'string' && opts.module !== ''
                ? guardListener(fn, { name, module: opts.module, flag: () => guard.flag?.(FLAG) === true, report: entry => guard.report?.(entry), problems: id => guard.problems?.(id), refresh: () => guard.refresh?.() })
                : fn;
            set.add(listener);
            return () => set.delete(listener);
        },
        emit(name, payload) {
            for (const fn of [...known(name)]) {
                try { fn(payload); } catch (error) { console.warn(`[Story Suite] a "${name}" listener failed`, error); }
            }
        },
    };
}
