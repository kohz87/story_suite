// Story Director v2, part **arc**: the world events block of the planner's brief (switch story-director.world-events; spec §9, ruling 9).
// The engine's mirror (the query `chronicle.world.brief`) as the planner reads it, after the tracker's threads: each Active world event
// as a thread of kind world-event (now, then "outcome decided by the world"), "Still to come" (pending backbone stages, titles only),
// and the conditions in the party's realm. No brief (the switch off): nothing, and the tracker text is as before.

import { WORLD_EVENT_RULE } from './world-rule.js';
import { DESC_POINTS, KEY_POINTS, PART_POINTS, flat } from '../shared.js';

/** The block's text (the react-not-resolve rule first), or '' when there is no brief (the switch is off). */
export function worldBriefText(brief) {
    if (!brief || typeof brief !== 'object') return '';
    const list = value => (Array.isArray(value) ? value : []);
    const lines = [WORLD_EVENT_RULE];
    const threads = list(brief.threads).filter(thread => thread && typeof thread.key === 'string');
    if (threads.length) {
        lines.push('World events:');
        for (const thread of threads) lines.push(`- ${flat(thread.key, KEY_POINTS)}${thread.now ? ` — ${flat(thread.now, DESC_POINTS)}` : ''}${thread.then ? ` → ${flat(thread.then, PART_POINTS)}` : ''}`);
    }
    const toCome = list(brief.toCome).filter(title => typeof title === 'string' && title.trim());
    if (toCome.length) lines.push('Still to come:', ...toCome.map(title => `- ${flat(title, KEY_POINTS)}`));
    const conditions = list(brief.conditions).filter(text => typeof text === 'string' && text.trim());
    if (conditions.length) lines.push('Conditions in this realm:', ...conditions.map(text => `- ${flat(text, DESC_POINTS)}`));
    return lines.join('\n');
}
