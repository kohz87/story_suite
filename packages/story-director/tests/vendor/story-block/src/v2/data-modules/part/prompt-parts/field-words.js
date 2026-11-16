// Words one field value for the prompt tail: plain values, Lists of entries, display names and bars.
import { DM_LIMITS as L, dmNameOf, dmDefaultTone } from '../../schema.js';
import { titlePart } from '../../interpreter.js';
import { barOf, sizeOf as barSizeOf, spreadWord, wordsOf } from '../../../lean-rpg/blocks.js';
import { oneLine } from '../../../../text.js';

const valueText = value => (typeof value === 'string' ? JSON.stringify(oneLine(value)) : Array.isArray(value) ? `${value.length} ${value.length === 1 ? 'entry' : 'entries'}` : String(value));
// A List of entries in the tail, short: each entry by its number and title and then its choices and numbers ("1 \"Find the key\" active; 2 \"Meet Wren\" done"),
// never its longer texts. The story needs the numbers and titles to name an entry, and what is still open. When the list does not fit `room` (characters), the
// open entries (by the status role's tone: not done or failed) come first, then the finished ones, each newest first; an entry is never cut in the middle, and
// the line ends "+N more". The entries shown keep their numbers and their order.
const entriesText = (definition, key, list, room = L.listTailTokens * 4) => {
    const schema = definition.state[key], parts = Object.entries(schema.of), title = titlePart(definition, key);
    const status = definition.roles?.field === key ? definition.roles.status : null;
    const pieces = list.map((entry, at) => [`${at + 1}`, title ? valueText(entry[title]) : null, ...parts.filter(([part, sub]) => part !== title && sub.type !== 'text').map(([part]) => String(entry[part]))].filter(Boolean).join(' '));
    const open = at => !status || ['active', 'neutral'].includes(definition.tones?.[list[at][status]] ?? dmDefaultTone(list[at][status]));
    // (newest first within each: when entries must go behind "+N more" the oldest are the ones hidden)
    const order = [...list.keys()].filter(open).reverse().concat([...list.keys()].filter(at => !open(at)).reverse());
    const budget = room - `${key}: `.length;
    const shown = [];
    let used = 0;
    for (const at of order) {
        const more = order.length - shown.length - 1 > 0 ? `; +${order.length - shown.length - 1} more`.length : 0;
        if (shown.length && used + pieces[at].length + 2 + more > budget) break;
        shown.push(at);
        used += pieces[at].length + 2;
    }
    const hidden = list.length - shown.length;
    return `${key}: ${shown.length ? `${shown.sort((a, b) => a - b).map(at => pieces[at]).join('; ')}${hidden ? `; +${hidden} more` : ''}` : 'none'}`;
};
// A number whose field has display names is shown (to a person and to the story) by its name; stored, it stays the number.
// The Standard formula's bars (a field with `blocks`) have no fixed names: their stage word depends on the bar's size, which `at` ({ fields, key }, the
// block's fields as they were then) gives; without it the number shows, as for any number.
const barText = (schema, value, at) => {
    const size = barSizeOf(schema, at.fields, at.key);
    return Number.isSafeInteger(value) ? spreadWord(wordsOf(barOf(schema)), Math.min(size, Math.max(0, value)), size) : valueText(value);
};
const shownText = (schema, value, at = null) => dmNameOf(schema, value) ?? (at && barOf(schema) ? barText(schema, value, at) : valueText(value));

export { valueText, entriesText, barText, shownText };
