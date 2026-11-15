// Story Director v2, tracker part (domain): keeps the Director's problem list: read, add, drop.

import { PROBLEM_ROOM, byKey } from './shared-problem-keys.js';
import { turnNumber } from './turn.js';
import { isInt, isRecord } from './shared-guards.js';

/** The problems kept, oldest first (an older state's list as it is). */
export function problemList(director) {
    const problems = director?.problems;
    if (Array.isArray(problems)) return problems.filter(isRecord);
    if (!isRecord(problems)) return [];
    return Object.keys(problems).sort(byKey).map(key => problems[key]).filter(isRecord);
}

/**
 * Adds a problem to the Director's list (a draft): under a key of its own, so it is one `add` that
 * never depends on another reply's; past PROBLEM_ROOM the oldest go. Returns its key.
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
    let n = 0;
    while (Object.hasOwn(director.problems, `${rev}.${n}`)) n += 1;
    director.problems[`${rev}.${n}`] = entry;
    const keys = Object.keys(director.problems);
    if (keys.length > PROBLEM_ROOM) for (const key of keys.sort(byKey).slice(0, keys.length - PROBLEM_ROOM)) delete director.problems[key];
    return `${rev}.${n}`;
}

/** Removes the problems `drop(problem)` says have gone (a draft). */
export function dropProblems(director, drop) {
    if (Array.isArray(director.problems)) {
        director.problems = director.problems.filter(problem => !drop(problem));
        return;
    }
    for (const [key, problem] of Object.entries(director.problems ?? {})) if (isRecord(problem) && drop(problem)) delete director.problems[key];
}
