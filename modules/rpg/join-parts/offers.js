// Join: the offers on a reply, read from its receipts.

import { oneLine } from '../../../core/text.js';
import { PARTY_ACTIVE, STATS_ANY as STATS } from '../names.js';
import { fold } from '../read.js';
import { isRecord } from './shared-record.js';

/**
 * The offers on a reply: the `+ party` lines that asked (Ask) or met a full party, read from the reply's receipts (`entries`: store.receipts() as a
 * query's tools give them, `{ index, receipt }`), minus the ones the reader answered (a `rpg.joinNo` receipt for the name, a `dm.join` for it, a return)
 * and the ones whose name is in the party now. → [{ name, about, soul, best }] in the order written. An offer that met a full party (`full`, a bench
 * choice) is asked again only while 4 are active, and "Not now" (`declined`) keeps it; a bench choice already made ends the list with
 * `{ name, done: true, benched }` (who stepped out), for the card to say so.
 */
export function joinOffers(entries, index, party = []) {
    const list = (Array.isArray(entries) ? entries : []).filter(entry => entry?.index === index && isRecord(entry.receipt?.data?.join));
    const answered = new Set(), declined = new Set(), done = [];
    for (const entry of list) {
        const join = entry.receipt.data.join, key = fold(join.name);
        if (join.op === 'no') declined.add(key);
        else if (typeof join.benched === 'string' && join.benched) {
            // (a bench choice counts only while the newcomer is in the party: a replay that skipped it leaves the offer as it was)
            if (!party.some(person => fold(person.name) === key && !person.left)) continue;
            answered.add(key);
            done.push({ name: oneLine(join.name), done: true, benched: oneLine(join.benched) });
        } else if (join.op === 'added' || join.op === 'back') answered.add(key);
    }
    const crowded = party.filter(person => !person.left).length >= PARTY_ACTIVE;
    const seen = new Map();
    const out = [];
    for (const entry of list) {
        const join = entry.receipt.data.join;
        if (join.op !== 'offer') continue;
        const key = fold(join.name);
        if (!key || answered.has(key)) continue;
        const known = seen.get(key);
        if (known) { known.recorded ||= join.full === true; known.back ||= join.back === true; known.four ||= join.four === true; continue; }
        const offer = { name: oneLine(join.name), about: oneLine(join.about), soul: Number.isSafeInteger(join.soul) ? join.soul : 1, best: STATS.includes(join.best) ? join.best : '',
            ...(Array.isArray(join.skills) && join.skills.length ? { skills: join.skills.slice(0, 8).map(skill => ({ name: oneLine(skill?.name), about: oneLine(skill?.about), stat: skill?.stat, uses: skill?.uses, rank: skill?.rank, ...(skill?.type === 'utility' ? { type: 'utility' } : {}) })) } : {}) };
        const state = { offer, recorded: join.full === true, back: join.back === true, four: join.four === true };
        seen.set(key, state);
        out.push(state);
    }
    const shown = [];
    for (const { offer, recorded, back, four } of out) {
        const key = fold(offer.name), person = party.find(entry => fold(entry.name) === key);
        if (person && !(back && person.left)) continue;
        const full = recorded && crowded;
        if (declined.has(key) && !full) continue;
        shown.push({ ...offer, ...(four ? { four: true } : {}), ...(full ? { full: true, ...(back ? { back: true } : {}), ...(declined.has(key) ? { declined: true } : {}) } : {}) });
    }
    return [...shown, ...done];
}
