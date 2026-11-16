// The receipt of a change: the summary line the next reply is told and the data for the reply card.
import { signed } from '../npc-meters-config.js';

export const sentence = parts => parts.filter(Boolean).map(part => (/[.!?]$/.test(part) ? part : `${part}.`)).join(' ');

// `pace`: the reader's words when pacing held the event (src/relationship-pacing.js pacingNote), else ''.
function changeText(name, moved, pace = '') {
    if (!moved.length) return pace ? `${name}: nothing changed (${pace})` : '';
    const why = item => (item.stop ? `, at the ${item.stop}` : '');
    return `${name}: ${moved.map(item => `${item.label.toLocaleLowerCase()} ${item.before} → ${item.after}${item.held && !pace ? ` (held at ${item.after}${why(item)}; ${signed(item.asked - item.before)} asked)` : ''}`).join(', ')}${pace ? ` (${pace})` : ''}`;
}

// The receipt: stage, ladder and note lines are what the next reply is told (narrate when a stage or
// a rung moved); the numbers are for the reply's card.
export function result({ name, key, moved, settled, problems, created, disposition, milestone = null, pace = '', dayRule = 0 }) {
    const notes = [...settled.stages.map(move => move.text), ...settled.ranks.map(move => move.text), ...settled.unlocked.map(note => note.text)];
    const numbers = changeText(name, moved, pace);
    const marked = milestone ? `${name}: milestone “${milestone.name}”` : '';
    const summary = sentence(notes.length
        ? [...notes, marked, numbers, settled.held]
        : [marked || numbers || (created ? `${name}: meters started` : `${name}: nothing moved`), marked ? numbers : '', settled.held, disposition ? `${name} is ${disposition}` : '']);
    return {
        summary,
        narrate: settled.stages.length > 0 || settled.ranks.length > 0,
        data: {
            name,
            key,
            created,
            changes: moved.map(({ meter, before, after, held, stop }) => ({ meter, before, after, held, ...(stop ? { stop } : {}) })),
            stages: settled.stages.map(({ meter, from, to }) => ({ meter, from, to })),
            ...(settled.ranks.length ? { ranks: settled.ranks.map(({ from, to }) => ({ from, to })) } : {}),
            ...(milestone ? { milestone: milestone.key } : {}),
            ...(dayRule ? { dayRule } : {}),
            unlocked: settled.unlocked.map(note => note.id),
            problems,
        },
    };
}
