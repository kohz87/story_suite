// Story Director v2, world: works out the names that must stay hidden and whether a line names one.

import { lineKey } from '../../changes.js';
import { BEHIND } from '../../../../ui/legacy/director/screens/reveal.js';
import { isRecord, text } from './shared-text.js';
import { threadsOf } from './shared-threads.js';

const arcsOf = state => (isRecord(state?.domains?.arc?.arcs) ? Object.values(state.domains.arc.arcs).filter(isRecord) : []);

/**
 * The names that must not reach the World screen or the Journal: `{ behind: Set, words: Set }` of keys
 * (lineKey). `behind`: every agenda, beat, clock and secret's own key and the names that reach it, and
 * every arc's name (a chronicle entry named so is left out). `words`: the secrets' keys and the arcs'
 * names (a journal line naming one is dropped; agendas are often named after people, who are known).
 */
export function hiddenNames(state) {
    const behind = new Set();
    const words = new Set();
    const director = state?.domains?.director;
    const kindOf = new Map(threadsOf(state).map(thread => [thread.id, thread.kind]));
    for (const thread of threadsOf(state)) {
        if (!BEHIND.has(thread.kind)) continue;
        const key = lineKey(text(thread.key));
        if (!key) continue;
        behind.add(key);
        if (thread.kind === 'secret') words.add(key);
    }
    for (const [name, id] of Object.entries(isRecord(director?.keys) ? director.keys : {})) {
        if (!BEHIND.has(kindOf.get(id))) continue;
        const key = lineKey(name);
        if (key) behind.add(key);
        if (key && kindOf.get(id) === 'secret') words.add(key);
    }
    for (const arc of arcsOf(state)) {
        const key = lineKey(text(arc.key));
        if (key) {
            behind.add(key);
            words.add(key);
        }
    }
    return { behind, words };
}

// Receipt lines of the arc planner an older digest may still hold ("New arc: …", "Arc ended: …", "Arc X: …").
const PLANNED_LINE = /^(?:New arc|Arc ended|Arc [^:]{1,80}):\s/;

/** Whether a free-text line (a journal line) names a hidden word as a whole phrase, or is an arc's own line. */
export function namesHidden(line, words) {
    if (PLANNED_LINE.test(text(line))) return true;
    if (!words?.size) return false;
    const key = ` ${lineKey(text(line))} `;
    for (const word of words) if (word && key.includes(` ${word} `)) return true;
    return false;
}
