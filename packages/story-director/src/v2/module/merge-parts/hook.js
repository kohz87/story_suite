// Story Director v2: merging several parts' functions under one hook name.

import { partView } from '../contexts.js';
import { isObject } from '../shared.js';
import { cueLinesOf } from './lines.js';

// Several parts' functions under one hook name, called in part order. beforeGenerate and afterCapture
// answers (string[] | { lines, commands }) are joined; canGenerate gives the first refusal; any other
// hook gives the last answer that is not undefined.
export function mergeHook(name, entries, shared) {
    const partView_ = (ns, view) => partView(ns, view, shared);
    // A hook that needs longer than the turn's default (the cast's planner answer is waited for) gives its limit (`fn.timeoutMs`); the merged one keeps the longest.
    const limit = Math.max(0, ...entries.map(([, fn]) => (Number.isFinite(fn?.timeoutMs) ? fn.timeoutMs : 0)));
    const withLimit = merged => (limit > 0 ? Object.assign(merged, { timeoutMs: limit }) : merged);
    // A hook that opted in to run for a reply with no change lines (`fn.always`): the merged hook opts in, and then runs only those parts.
    const always = entries.some(([, fn]) => fn?.always === true);
    const withAlways = merged => (always ? Object.assign(merged, { always: true }) : merged);
    if (entries.length === 1) {
        const [[ns, fn]] = entries;
        return withAlways(withLimit((view, ...rest) => fn(partView_(ns, view), ...rest)));
    }
    return withAlways(withLimit(async (view, ...rest) => {
        if (name === 'beforeGenerate' || name === 'afterCapture') {
            const lines = [];
            const commands = [];
            const problems = [];
            for (const [ns, fn] of entries) {
                if (rest[0]?.always === true && fn?.always !== true) continue;
                const out = await fn(partView_(ns, view), ...rest);
                lines.push(...cueLinesOf(Array.isArray(out) ? out : out?.lines));
                if (Array.isArray(out?.commands)) commands.push(...out.commands);
                // A part's problems (`{ code, message }`) go on to Story Block's Problems list.
                if (Array.isArray(out?.problems)) problems.push(...out.problems);
            }
            return problems.length ? { lines, commands, problems } : { lines, commands };
        }
        let answer;
        for (const [ns, fn] of entries) {
            const out = await fn(partView_(ns, view), ...rest);
            if (name === 'canGenerate' && (out === false || (isObject(out) && out.ok === false))) return out;
            if (out !== undefined) answer = out;
        }
        return answer;
    }));
}
