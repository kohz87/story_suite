// Story Director v2, part screens: the behind-the-scenes views: whether they are hidden, and the threads behind the scenes with their problems (`director.behind`).

import { BEHIND_KINDS } from '../reveal.js';
import { queryFrom } from './shared-ask.js';
import { problemsList } from './problems.js';
import { threadsOf } from './shared-threads.js';
import { isRecord, text } from './shared-words.js';

/** Whether the reader hides behind the scenes (the part's `hideBehind` setting; on unless set off). */
export function hidingBehind(tools) {
    try {
        return typeof tools?.settings === 'function' ? tools.settings()?.hideBehind !== false : true;
    } catch {
        return true;
    }
}

// A thread as the behind-the-scenes list shows it; a secret by its name alone.
export function behindThread(thread) {
    if (thread.kind === 'secret') return { id: thread.id, key: text(thread.key), summary: '', fields: {}, ended: null };
    const fields = {};
    for (const name of ['now', 'then', 'on', 'due', 'place', 'reach', 'shown', 'arrive', 'where', 'stepAt', 'stepOf', 'stepSince']) if (text(thread.fields?.[name])) fields[name] = text(thread.fields[name]);
    return { id: thread.id, key: text(thread.key), summary: text(thread.summary), fields, ended: thread.ended ? { outcome: text(thread.ended.outcome) } : null };
}

/**
 * `director.behind` → `{ kinds: [{ kind, title, open, closed }], problems, open, total }`: the threads behind
 * the scenes (agendas, clocks, beats, secrets: open ones and the closed ones), the problems about them, and
 * how many there are, for the Reveal panel (widget `story-director.behind`).
 */
export function behindView(state, args, tools) {
    const query = queryFrom(tools);
    const kinds = BEHIND_KINDS.map(([kind, title]) => ({
        kind,
        title,
        open: threadsOf(state, query, { kind, status: 'active', open: true }).filter(isRecord).map(behindThread),
        closed: threadsOf(state, query, { kind, status: 'resolved' }).filter(isRecord).map(behindThread),
    })).filter(group => group.open.length || group.closed.length);
    const open = kinds.reduce((sum, group) => sum + group.open.length, 0);
    const total = kinds.reduce((sum, group) => sum + group.open.length + group.closed.length, 0);
    return { kinds, problems: problemsList(state, { behind: true }, tools), open, total };
}
