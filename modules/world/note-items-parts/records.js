// Story Director: arrival, quest and general record item formatting for the note.

import { questDifficulty } from '../changes.js';
import { ITEM_SEPARATOR } from '../note-format.js';
import { destination, noteFields } from './shared-fields.js';
import { fightPart } from './encounters.js';

// "Courier arrives Varnhold Watch (Goldwane 16, morning)".
export function arrivalItem(record, verb = 'arrives') {
    const f = noteFields(record);
    const where = destination(f.leg);
    // With nowhere to reach, an arrival in the past just "arrived".
    const said = where ? verb : verb === 'reached' ? 'arrived' : verb;
    return `${record.key} ${said}${where ? ` ${where}` : ''}${f.arrive ? ` (${f.arrive})` : ''}`;
}

// "Geva — Bailiff Court → files the warrant (Goldwane 17)",
// "Hollin's Reach graves — the dead rise (Goldwane 28) · shown: sign".
// "Bounty on Kettle Jack — bring him in alive · at: cornered at the weir · for Warden Hale · 40 crowns · by Haywane 30".
export function questItem(record, clock = text => text) {
    const f = noteFields(record);
    const parts = [f.goal || f.desc, f.step ? `at: ${f.step}` : '', f.giver ? `for ${f.giver}` : '', f.reward, f.due ? `by ${clock(f.due)}` : '']
        .map(part => String(part ?? '').trim())
        .filter(Boolean);
    // A normal difficulty goes without saying; a set one rides with the type: "(bounty, hard)".
    const difficulty = questDifficulty(f.difficulty);
    const tags = [String(f.type ?? '').trim(), difficulty === 'normal' ? '' : difficulty].filter(Boolean);
    return record.key + (tags.length ? ` (${tags.join(', ')})` : '') + (parts.length ? ` — ${parts.join(ITEM_SEPARATOR)}` : '') + fightPart(record);
}

export function recordItem(record, clock) {
    if (record.kind === 'quest') return questItem(record, clock);
    const f = noteFields(record);
    const body = [];
    const state = f.now || f.desc;
    if (state) body.push(state);
    const when = record.kind === 'clock' ? f.due : f.on;
    if (f.then) body.push(`${state ? '→ ' : ''}${f.then}${when ? ` (${when})` : ''}`);
    if (f.arrive) {
        const where = destination(f.leg);
        body.push(`${body.length ? '→ ' : ''}arrives${where ? ` ${where}` : ''} (${f.arrive})`);
    }

    let item = record.key + (body.length ? ` — ${body.join(' ')}` : '');
    // With no then, the date belongs to the record itself (a beat's on, a clock's due).
    if (when && !f.then) item += ` (${when})`;
    if (record.kind === 'clock' && f.shown && !/^none$/i.test(f.shown.trim())) item += `${ITEM_SEPARATOR}shown: ${f.shown}`;
    return item + fightPart(record);
}
