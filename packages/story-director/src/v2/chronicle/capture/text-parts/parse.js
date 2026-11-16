// Story Director v2, chronicle part: parses state words, name lists, and text values for chronicle capture lines.

import { MAX_NAMED, STATES, cleanName, keyOf } from '../../domain.js';

// The separator between a word and more text inside a label: an em or en dash, or a spaced hyphen.
const TEXT_DASH = /\s*[—–]\s*|\s+-\s+/;
const LIST = /\s*[,;/]\s*|\s+(?:and|&|vs\.?|versus|against)\s+/i;
export const CLEAR = /^(?:none|-|—|nothing|nowhere|no one)$/i;

// The words a model writes for each state.
const STATE_WORDS = Object.freeze({
    looming: ['looming', 'brewing', 'rumoured', 'rumored', 'building', 'threatened', 'pending', 'rising', 'gathering', 'imminent'],
    ongoing: ['ongoing', 'active', 'underway', 'under way', 'open', 'raging', 'spreading', 'escalating', 'continuing', 'worsening', 'waning'],
    resolved: ['resolved', 'ended', 'over', 'done', 'finished', 'closed', 'averted', 'defeated', 'won', 'lost', 'stopped', 'ended peacefully'],
});

export const asText = value => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value));

/** A state word (`resolved — slain at the pass`): `{ state, rest }`, or `{ error }`. */
export function readState(value) {
    const text = asText(value).trim();
    const dash = TEXT_DASH.exec(text);
    const word = (dash ? text.slice(0, dash.index) : text).trim().toLowerCase().replace(/[.!]+$/, '');
    const rest = dash ? text.slice(dash.index + dash[0].length).trim() : '';
    const state = STATES.find(name => STATE_WORDS[name].includes(word));
    if (!state) return { error: `"${word || text}" is not a state; write looming, ongoing or resolved.` };
    return { state, rest };
}

/** Names in a list label (`Ashen Court, River Guild`), cleaned, at most `max`, no repeats. */
export function readNames(value, max = MAX_NAMED) {
    const out = [];
    for (const part of asText(value).split(LIST)) {
        const name = cleanName(part);
        if (!keyOf(name) || CLEAR.test(name) || out.some(other => keyOf(other) === keyOf(name))) continue;
        out.push(name);
        if (out.length >= max) break;
    }
    return out;
}
