// Story Director v2, part **arc**: building the planner model request and tracker summary.

import { DESC_POINTS, KEY_POINTS, PART_POINTS, flat } from '../shared.js';
import { DEFAULT_PLANNER_PROMPT, FIGHT_RULE, NO_FIGHT_RULE, PLANNER_ASK } from './template.js';

const NONE = '(none)';
const MACRO = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

/**
 * The planner call's `{ system, prompt }`: the reader's template (empty: the default) with its macros
 * filled. `{{user}}` and `{{char}}` (and any other macro) stay for Story Block's substitute.
 */
export function plannerRequest({ template = '', genre = '', now = '', place = '', note = '', previousArc = '', tracker = '', recent = '', fights = true } = {}) {
    const values = {
        genre, now, place, note, previous_arc: previousArc, tracker, recent,
        fights: fights ? FIGHT_RULE : NO_FIGHT_RULE,
    };
    const source = String(template ?? '').trim() ? String(template) : DEFAULT_PLANNER_PROMPT;
    const system = source.replace(MACRO, (whole, name) => {
        const key = name.toLowerCase();
        if (!Object.hasOwn(values, key)) return whole;
        return String(values[key] ?? '').trim() || NONE;
    });
    return { system, prompt: PLANNER_ASK };
}

/** What the Director tracks, as the planner reads it: open threads by kind, then the last few closed. */
export function trackerSummary(threads = [], { closedShown = 8 } = {}) {
    const headings = { quest: 'Quests', hook: 'Hooks', agenda: 'Agendas', event: 'World', clock: 'Clocks', beat: 'Beats', secret: 'Secrets' };
    const lines = [];
    const open = threads.filter(thread => thread?.status === 'active');
    for (const kind of Object.keys(headings)) {
        const group = open.filter(thread => thread.kind === kind);
        if (!group.length) continue;
        lines.push(`${headings[kind]}:`);
        for (const thread of group) {
            const fields = thread.fields ?? {};
            let line = `- ${flat(thread.key, KEY_POINTS)}`;
            const what = flat(fields.now || thread.summary, DESC_POINTS);
            if (what) line += ` — ${what}`;
            if (fields.then) line += ` → ${flat(fields.then, PART_POINTS)}`;
            const when = fields.on || fields.due;
            if (when) line += ` (${flat(when, PART_POINTS)})`;
            lines.push(line);
        }
    }
    const closed = threads.filter(thread => thread?.status !== 'active').slice(-closedShown);
    if (closed.length) {
        lines.push('Resolved:');
        for (const thread of closed) lines.push(`- ${flat(thread.key, KEY_POINTS)}${thread.ended?.reason ? ` — ${flat(thread.ended.reason, PART_POINTS)}` : ''}`);
    }
    return lines.length ? lines.join('\n') : '(nothing tracked yet)';
}
