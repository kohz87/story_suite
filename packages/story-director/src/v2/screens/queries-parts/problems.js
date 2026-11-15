// Story Director v2, part screens: the Director problems in the reader's words (`director.problems`), and which of them are about threads behind the scenes.

import { lineKey } from '../../../changes.js';
import { problemList } from '../../tracker/domain.js';
import { BEHIND } from '../reveal.js';
import { isOpen } from './shared-threads.js';
import { isRecord, text } from './shared-words.js';

// The problems the Director screen shows (the tracker's PROBLEM_LIMIT).
const PROBLEM_SHOWN = 50;

// v1's problem texts name the reader as the `{{user}}` macro. Without the host's substitution they read
// "you", with the few phrases where that changes the verb or pronoun put right.
const YOU = [
    [/\{\{user\}\}'s choice, and their message/gi, 'your choice, and your message'],
    [/\{\{user\}\} accepts/gi, 'you accept'],
    [/\{\{user\}\}'s/gi, 'your'],
    [/\{\{user\}\}/gi, 'you'],
];
export function readerWords(value, substitute = null) {
    let out = String(value ?? '');
    if (typeof substitute === 'function' && out.includes('{{')) {
        try {
            const named = substitute(out);
            if (typeof named === 'string') out = named;
        } catch { /* "you" below */ }
    }
    for (const [pattern, words] of YOU) out = out.replace(pattern, words);
    return out;
}

// A Problem about a passing state of a quest is shown only while that state lasts: "has no goal" while it
// is open with no goal (its `goal:` field). An older
// chat's "was offered, not taken on" is not shown: there is nothing to accept any more.
function stillSo(problem, director) {
    if (problem.kind === 'offered') return false;
    if (problem.kind !== 'no-goal') return true;
    const id = director?.keys?.[lineKey(text(problem.key))];
    const thread = id ? director?.threads?.[id] : null;
    if (!thread) return true;
    if (!isOpen(thread)) return false;
    return !text(thread.fields?.goal);
}

/**
 * `director.problems` → the last replies' Director problems, oldest first as kept: `[{ rev, kind, text }]`,
 * the text with `{{user}}` written out (the host's `tools.substitute` when there is one, else "you"). A
 * Problem about a missing goal is left out once the quest is given a goal or over; one about an offer, always.
 */
export function problemsList(state, args, tools) {
    const director = state?.domains?.director;
    const problems = problemList(director);
    const substitute = typeof tools?.substitute === 'function' ? tools.substitute : null;
    // `behind: true` / `false`: only those about a thread behind the scenes, or only the others.
    const behind = typeof args?.behind === 'boolean' ? args.behind : null;
    // The newest PROBLEM_SHOWN: the tracker keeps more than that (domain.js PROBLEM_ROOM).
    return problems.slice(-PROBLEM_SHOWN).filter(isRecord).filter(problem => stillSo(problem, director))
        .filter(problem => behind === null || isBehindProblem(problem, director) === behind).map(problem => ({
        rev: problem.rev ?? null,
        kind: text(problem.kind),
        text: readerWords(problem.text, substitute),
    }));
}

/** Whether a Director problem is about a thread behind the scenes (its key names an agenda, beat, clock or secret). */
export function isBehindProblem(problem, director) {
    const key = lineKey(String(problem?.key ?? ''));
    const keys = isRecord(director?.keys) ? director.keys : {};
    if (!key || !Object.hasOwn(keys, key)) return false;
    const threads = isRecord(director?.threads) ? director.threads : {};
    const id = keys[key];
    return Object.hasOwn(threads, id) && BEHIND.has(threads[id]?.kind);
}
