// Story Director v2, part **arc**: the world events block of the planner's brief (switch story-director.world-events; spec §9, ruling 9).
// The engine's mirror (the query `chronicle.world.brief`) as the planner reads it, after the tracker's threads: each Active world event
// as a thread of kind world-event (now, then "outcome decided by the world"), "Still to come" (pending backbone stages, names only),
// and the conditions in the party's realm; the EVENT line's rule follows the react-not-resolve rule. No brief (the switch off): nothing, and the tracker text is as before.

import { EVENT_LINE_RULE, WORLD_EVENT_RULE } from './world-rule.js';
import { DESC_POINTS, KEY_POINTS, PART_POINTS, flat } from '../shared.js';

const SECRETS_RULE = 'Secrets not yet learned (never surface or hint at them in a beat, clock or agenda; they come out only when the story earns it):';

/**
 * A world event's line: "name — now". The name is said on its own even when `now` starts with it (an event with no title is named by its
 * summary): it is what an EVENT line and the judge cite.
 */
export function eventLine(name, now, cut = (text, points) => flat(text, points)) {
    if (!now) return cut(name, DESC_POINTS);
    return `${cut(name, KEY_POINTS)} — ${cut(now, DESC_POINTS)}`;
}

/** The block's text (the react-not-resolve rule first), or '' when there is no brief (the switch is off). */
export function worldBriefText(brief) {
    if (!brief || typeof brief !== 'object') return '';
    const list = value => (Array.isArray(value) ? value : []);
    const lines = [WORLD_EVENT_RULE, EVENT_LINE_RULE];
    const threads = list(brief.threads).filter(thread => thread && typeof thread.key === 'string');
    if (threads.length) {
        lines.push('World events:');
        for (const thread of threads) lines.push(`- ${eventLine(thread.key, thread.now)}${thread.then ? ` → ${flat(thread.then, PART_POINTS)}` : ''}`);
    }
    const toCome = list(brief.toCome).filter(title => typeof title === 'string' && title.trim());
    if (toCome.length) lines.push('Still to come:', ...toCome.map(title => `- ${flat(title, DESC_POINTS)}`));
    const conditions = list(brief.conditions).filter(text => typeof text === 'string' && text.trim());
    if (conditions.length) lines.push('Conditions in this realm:', ...conditions.map(text => `- ${flat(text, DESC_POINTS)}`));
    // Pack secrets not yet learned (NPC State holds them; the narrator is told none until its gate opens): the planner sees them, never to surface or hint.
    const secrets = list(brief.secrets).filter(item => item && typeof item.name === 'string' && typeof item.text === 'string' && item.text.trim());
    if (secrets.length) lines.push(SECRETS_RULE, ...secrets.map(item => `- ${flat(item.name, KEY_POINTS)}: ${flat(item.text, DESC_POINTS)}`));
    return lines.join('\n');
}
