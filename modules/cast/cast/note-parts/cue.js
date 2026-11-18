// Story Director v2, part **cast**: building the narrator's meeting cue and checking its freshness.

import { TAIL_BUDGET } from '../settings.js';
import { cutWords, isInt, slotOf } from '../domain.js';
import { whyNarrator } from '../apply.js';

const FRESH_REPLIES = 2;

/** Whether the meeting recorded in `slot` is for the reply being written now (`at`: the chat's length when it was decided). */
export function meetingFresh(slot, at) {
    const meeting = slotOf(slot);
    return Boolean(meeting) && isInt(at) && isInt(meeting.at) && at >= meeting.at && at < meeting.at + FRESH_REPLIES;
}

/** `text` with the person's name (a whole word, any case) replaced by `label`: a cue for a stranger never carries the name. */
function maskName(text, name, label) {
    const said = String(name ?? '').trim();
    if (!said) return text;
    const parts = said.split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return String(text ?? '').replace(new RegExp(`(?<![\\p{L}\\p{N}_])${parts.join('\\s+')}(?![\\p{L}\\p{N}_])`, 'giu'), label);
}

const sentence = text => (/[.!?…]$/.test(text) ? text : `${text}.`);

// The descriptive fields in the order they are kept, each with the most it may take.
const FIELDS = [['Who', 'about', 240], ['Look', 'look', 200], ['Voice', 'voice', 140], ['Manner', 'personality', 140]];
const CLOSING = 'Bring them in naturally; do not treat them as known to {{user}} yet.';
const WHY_MAX = 260;

/**
 * One person's cue, at most `room` characters. What matters comes first and always survives whole: who comes (the name), why now (the
 * reason the story gave, or where they are) and how to bring them in; the descriptive fields (who they are, how they look, how they
 * speak, their manner, what they want) fill what is left, each cut at a word, and a field with no room is left out.
 */
export function cueOf(person, entry, room = TAIL_BUDGET * 4 - 8 - '[Cast] '.length) {
    const raw = entry?.raw ?? {};
    // A stranger's name forms ("Tansy" for Tansy Millrace) are names too: only a descriptive alias ("the ferrywoman") is told.
    const words = new Set(String(person.name ?? '').toLowerCase().split(/\s+/).filter(Boolean));
    const all = Array.isArray(person.aliases) ? person.aliases : [];
    const aliases = (person.met?.why === 'story' ? all : all.filter(alias => !String(alias).toLowerCase().split(/\s+/).some(word => words.has(word)))).slice(0, 2);
    // A stranger met for the first time has no name yet in the story: the cue gives the alias and says so. Someone the story already named (`why: 'story'`) keeps the name.
    const unnamed = person.met?.why !== 'story';
    const label = aliases[0] || 'a stranger';
    // Every word of the name (first or family name, 3+ letters) is masked too, whatever the aliases are.
    // A word the reader said themselves in their sought request ("a sister") is theirs to hear back, so it stays.
    const said = String(person.met?.reason ?? '').toLowerCase();
    const nameWords = Array.from(words).filter(word => Array.from(word).length >= 3 && !said.includes(word));
    const hide = text => (unnamed ? [person.name, ...all, ...nameWords].reduce((out, name) => maskName(out, name, label), text) : text);
    const intro = unnamed
        ? `${label}${aliases.length > 1 ? ` (also ${aliases.slice(1).join(', ')})` : ''} comes into the scene in this reply. It is their first meeting with {{user}}, and {{user}} does not know their name until it is said in the story: do not use it before someone says it.`
        : `${person.name}${aliases.length ? ` (also ${aliases.join(', ')})` : ''} comes into the scene in this reply. It is their first meeting with {{user}}.`;
    const why = sentence(`Why now: ${cutWords(hide(whyNarrator(person)), WHY_MAX)}`);
    let left = room - [intro, why, CLOSING].reduce((sum, part) => sum + Array.from(part).length + 1, 0);
    const kept = [];
    for (const [label, key, max] of [...FIELDS, ['Wants', null, 120]]) {
        const value = key === null ? entry?.goal : raw[key];
        const flatText = cutWords(hide(String(value ?? '')), max);
        if (!flatText) continue;
        // `Label: ` and the full stop are the field's own; a field needs room for a few words at least.
        const overhead = label.length + 3;
        if (left - overhead < 24) continue;
        const text = sentence(`${label}: ${cutWords(flatText, left - overhead - 1)}`);
        kept.push(text);
        left -= Array.from(text).length + 1;
    }
    return [intro, ...kept, why, CLOSING].join(' ');
}
