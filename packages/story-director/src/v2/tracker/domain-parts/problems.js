// Story Director v2, tracker part (domain): keeps the Director's problem list: read, add, drop.

import { PROBLEM_ROOM, problemOrder } from './shared-problem-keys.js';
import { replyKey } from '../../reply-keys.js';
import { turnNumber } from './turn.js';
import { isInt, isRecord } from './shared-guards.js';

/** The problems kept, oldest first (an older state's list as it is). */
export function problemList(director) {
    const problems = director?.problems;
    if (Array.isArray(problems)) return problems.filter(isRecord);
    if (!isRecord(problems)) return [];
    return Object.entries(problems).filter(([, problem]) => isRecord(problem)).sort(problemOrder).map(([, problem]) => problem);
}

/**
 * Adds a problem to the Director's list (a draft): under a key of its own reply's (`<sid>.<n>`, reply-keys.js), so it is one
 * `add` that never depends on another reply's and that no other reply's stored `add` can land on; past PROBLEM_ROOM the oldest
 * (problemOrder) go. Returns its key.
 */
export function addProblem(director, ctx, problem) {
    const rev = Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0;
    const entry = { rev, turn: turnNumber(director), ...problem };
    for (const name of Object.keys(entry)) if (entry[name] === undefined) delete entry[name];
    // An older state's list is keyed once (the whole list is written then).
    if (!isRecord(director.problems)) {
        const old = problemList(director).slice(-PROBLEM_ROOM);
        director.problems = Object.fromEntries(old.map((item, n) => [`${isInt(item.rev) ? item.rev : 0}.${n}`, item]));
    }
    const key = replyKey(ctx, director.problems);
    director.problems[key] = entry;
    const entries = Object.entries(director.problems);
    if (entries.length > PROBLEM_ROOM) for (const [old] of entries.sort(problemOrder).slice(0, entries.length - PROBLEM_ROOM)) delete director.problems[old];
    return key;
}

/** Removes the problems `drop(problem)` says have gone (a draft). */
export function dropProblems(director, drop) {
    if (Array.isArray(director.problems)) {
        director.problems = director.problems.filter(problem => !drop(problem));
        return;
    }
    for (const [key, problem] of Object.entries(director.problems ?? {})) if (isRecord(problem) && drop(problem)) delete director.problems[key];
}
