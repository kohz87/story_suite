// Builds the four effect entries (rumour, chance meeting, arrival, schedule shift) from their candidates.

import { lineKey } from '../../changes.js';
import { isPersona } from '../../../time/tracker/initiative.js';
import { pickIndex, plainSlot } from '../tables.js';
import { REPLY_MINUTES } from './limits.js';
import { isInt, isRecord, unit, frac } from './shared-guards.js';
import { NAME_MAX, TOPIC_MAX, FACTIONS_MAX, byId } from './shared-names.js';

/**
 * A rumour from one known fact (`known`: [{ id, name, summary, place, factions }]), for GOSSIP_SURGE (talk) or OVERHEARD_DETAIL
 * (snatches). The chronicle event is `looming` and is keyed by the chat's length (`at`), so a swipe that removes the reply removes it.
 */
export function rumourEntry(kind, { known = [], behind = new Set(), at = null, place = '', draw = {} } = {}) {
    if (!isInt(at)) return null;
    const facts = (Array.isArray(known) ? known : [])
        .filter(fact => isRecord(fact) && !fact.rumour && plainSlot(fact.name, NAME_MAX) && !/^rumou?rs? of /i.test(plainSlot(fact.name, NAME_MAX)) && !behind.has(lineKey(fact.name)))
        .map(fact => ({ ...fact, id: plainSlot(fact.id ?? fact.name, NAME_MAX) }))
        .sort(byId);
    const fact = facts[pickIndex(facts.length, unit(draw.actor))];
    if (!fact) return null;
    const name = plainSlot(fact.name, NAME_MAX);
    const summary = plainSlot(fact.summary, TOPIC_MAX) || name;
    const where = plainSlot(place, NAME_MAX);
    const factions = (Array.isArray(fact.factions) ? fact.factions : []).map(item => plainSlot(item, NAME_MAX)).filter(Boolean).slice(0, FACTIONS_MAX);
    const id = `pulse-${at}`;
    const tail = kind === 'OVERHEARD_DETAIL'
        ? `Snatches of talk${where ? ` in ${where}` : ''} mention ${summary}.`
        : `Talk${where ? ` in ${where}` : ''} runs to ${summary}.`;
    return {
        kind,
        type: 'chronicle.rumor',
        payload: { at, event: { id, name: `Rumour of ${name}`, summary, state: 'looming', place: where, factions, rumour: name } },
        tail,
        receipt: { event: id },
    };
}

/**
 * CHANCE_MEETING: one unmet, living cast person (`cast`: the cast domain) comes across the party at `place` (required: a place
 * the reader is at). Met by the pulse, so the person is met now; the line names them (the cast's own cue rides with it, see `rollEntry`).
 */
export function meetEntry({ cast = null, at = null, place = '', draw = {}, here = null, persona = '' } = {}) {
    const where = plainSlot(place, NAME_MAX);
    if (!isInt(at) || !where || !isRecord(cast?.people)) return null;
    const people = Object.keys(cast.people).sort()
        .map(key => ({ key, person: cast.people[key] }))
        .filter(({ key, person }) => isRecord(person) && person.alive !== false && !person.met && plainSlot(person.name, NAME_MAX) && !isPersona({ key, name: person.name }, persona));
    const pick = people[pickIndex(people.length, unit(draw.actor))];
    if (!pick) return null;
    return {
        kind: 'CHANCE_MEETING',
        type: 'cast.meet',
        // `here` (every new reply: the keys of candidates already at the place): met by place, nobody is moved; the rest come by their way there.
        payload: { at, who: [here?.has(pick.key) ? { key: pick.key, why: 'place', reason: '' } : { key: pick.key, why: 'goal', reason: 'chance meeting', place: where }] },
        // The person is met in this reply, so the line may name them; the cast's cue (who they are, how to bring them in) goes with it.
        tail: `${plainSlot(pick.person.name, NAME_MAX)} crosses your path in ${where}, by chance.`,
        receipt: { who: pick.key },
    };
}

/**
 * ENTER_CHECK: an off-screen agenda's `arrive` moves 1 or 2 replies ahead of `now` (story minutes). `agendas`: [{ id, name, named }]
 * (open, off-screen, with an arrival or a leg); `format(minutes)` gives the calendar text for the new date (null: cannot happen).
 */
export function arrivalEntry({ agendas = [], now = null, at = null, format = null, draw = {} } = {}) {
    if (!isInt(now) || !isInt(at) || typeof format !== 'function') return null;
    const open = (Array.isArray(agendas) ? agendas : []).filter(item => isRecord(item) && plainSlot(item.id, NAME_MAX)).map(item => ({ ...item, id: plainSlot(item.id, NAME_MAX) })).sort(byId);
    const pick = open[pickIndex(open.length, unit(draw.actor))];
    if (!pick) return null;
    const replies = 1 + Math.floor(unit(draw.line) * 2);
    const arriveAt = now + replies * REPLY_MINUTES;
    const text = plainSlot(format(arriveAt), NAME_MAX);
    if (!text) return null;
    const who = pick.named ? plainSlot(pick.name, NAME_MAX) : '';
    return {
        kind: 'ENTER_CHECK',
        type: 'director.pulse.arrive',
        payload: { at, thread: pick.id, field: 'arrive', from: typeof pick.arrive === 'string' ? pick.arrive : '', to: text },
        tail: who ? `${who} may arrive soon.` : 'Someone you have been expecting may arrive soon.',
        receipt: { thread: pick.id, arriveAt },
    };
}

/**
 * TASK_SHIFT: an off-screen agenda's step `on` moves early or late by 1 to 4 hours. `agendas`: [{ id, name, named, text, abs }] where
 * `text` is the stored date and `abs` its story minutes (the caller parses it); `format(minutes)` gives the new date's text.
 * Direction is the `line` draw below one half (early); the hours come from its fractional part, so they do not depend on it.
 * An early shift is clamped to `now` (story minutes) + REPLY_MINUTES: `on` never moves into the past.
 */
export function shiftEntry({ agendas = [], at = null, now = null, format = null, draw = {} } = {}) {
    if (!isInt(at) || !isInt(now) || typeof format !== 'function') return null;
    const open = (Array.isArray(agendas) ? agendas : [])
        .filter(item => isRecord(item) && plainSlot(item.id, NAME_MAX) && typeof item.text === 'string' && item.text.trim() && Number.isFinite(item.abs))
        .map(item => ({ ...item, id: plainSlot(item.id, NAME_MAX) }))
        .sort(byId);
    const pick = open[pickIndex(open.length, unit(draw.actor))];
    if (!pick) return null;
    const line = unit(draw.line);
    const early = line < 0.5;
    const hours = 1 + Math.floor(frac(line * 2) * 4);
    // Never into the past: an early shift stops REPLY_MINUTES after `now`, and one that would not move the date earlier cannot happen.
    const target = early ? Math.max(pick.abs - hours * 60, now + REPLY_MINUTES) : pick.abs + hours * 60;
    if (early && target >= pick.abs) return null;
    const shift = target - pick.abs;
    const to = plainSlot(format(target), NAME_MAX);
    if (!to) return null;
    const who = pick.named ? plainSlot(pick.name, NAME_MAX) : '';
    const tail = early
        ? (who ? `${who} is ahead of schedule.` : 'Something out of sight is running ahead of schedule.')
        : (who ? `${who} is running late.` : 'Something out of sight is running late.');
    return {
        kind: 'TASK_SHIFT',
        type: 'director.pulse.shift',
        payload: { at, thread: pick.id, field: 'on', from: pick.text.trim(), to, shift },
        tail,
        receipt: { thread: pick.id, from: pick.abs, to: pick.abs + shift },
    };
}
