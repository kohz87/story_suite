// Story Director: due, pay-waiting and While-away recap item formatting for the note.

import { waitsForPay } from '../tracker.js';
import { AWAY_ARRIVAL, AWAY_CUE, AWAY_DEADLINE, AWAY_RECORD } from '../note-text.js';
import { ITEM_SEPARATOR } from '../note-format.js';
import { noteFields } from './shared-fields.js';
import { withAwayFight, withReach } from './encounters.js';
import { arrivalItem } from './records.js';

// "Saartje's sale (Goldwane 16)", or with what is meant to happen: "Geva — files the warrant (Goldwane 17)".
export function dueItem(record, clock = text => text) {
    const f = noteFields(record);
    // (0.9.28) The work done and only the pay left, its time is when the pay can be had.
    if (record.kind === 'quest' && waitsForPay(record)) return payItem(record, clock);
    // A quest's due is its deadline: reaching it means time ran out.
    if (record.kind === 'quest') return `${record.key} — deadline${f.due ? ` ${clock(f.due)}` : ''} reached${f.goal ? ` (${f.goal})` : ''}`;
    const when = record.kind === 'clock' ? f.due || f.on : f.on || f.due;
    const what = f.then || (record.kind === 'clock' ? f.desc : '');
    return `${record.key}${what ? ` — ${what}` : ''}${when ? ` (${when})` : ''}`;
}

// (0.9.19) "While away (Goldwane 12, 08:00 pm → Goldwane 15, 07:00 am): Stray Oar — sacked
// (Goldwane 13) · Bond collector reached Hollin's Reach (Goldwane 14) · Bounty — deadline
// Goldwane 14, 11:59 pm passed. Show what came of them …". A planned fight in the gap was fought
// off-screen. '' with nothing in the gap.
export function awayPart(away, calendar, clock, instruction) {
    const items = [
        // A beat's reach is the aftermath to show: most needed here, where it happened unseen.
        ...(away?.due ?? []).map(record => withReach(withAwayFight(awayDueItem(record, clock), record), record)),
        ...(away?.arriving ?? []).filter(record => !(away?.due ?? []).includes(record)).map(record => withAwayFight(arrivalItem(record, 'reached'), record)),
    ].filter(Boolean);
    if (!items.length) return '';
    const span = `${calendar.format(away.from, { era: false })} → ${calendar.format(away.to, { era: false })}`;
    const record = instruction
        ? [AWAY_RECORD, away.arriving?.length ? AWAY_ARRIVAL : '', (away.due ?? []).some(entry => entry.kind === 'quest' && !waitsForPay(entry)) ? AWAY_DEADLINE : '']
        : [];
    const list = items.join(ITEM_SEPARATOR);
    // A list ending in a trimmed part ("…") needs no full stop after it.
    return [`While away (${span}): ${list}${/[.…]$/u.test(list) ? '' : '.'}`, AWAY_CUE, ...record].filter(Boolean).join(' ');
}

// A due item as it reads in the past: a quest's deadline "passed", not "reached".
// "Lone Grey Wolf — pay waiting from Goldwane 14, 12:00 pm (turn in voucher at the bailiff hatch);
// the work is done, the hour fails nothing".
export function payItem(record, clock) {
    const f = noteFields(record);
    const step = f.step || f.now;
    return `${record.key} — pay waiting${f.due ? ` from ${clock(f.due)}` : ''}${step ? ` (${step})` : ''}; the work is done, the hour fails nothing`;
}

export function awayDueItem(record, clock) {
    if (record.kind !== 'quest' || waitsForPay(record)) return dueItem(record, clock);
    const f = noteFields(record);
    return `${record.key} — deadline${f.due ? ` ${clock(f.due)}` : ''} passed${f.goal ? ` (${f.goal})` : ''}`;
}
