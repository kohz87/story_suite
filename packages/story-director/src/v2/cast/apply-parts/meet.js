// Formats meeting explanations and applies cast meeting payloads.

import { MAX_PLACE, MAX_REASON, cutPoints, isAlive, isInt, isMet, isRecord } from '../domain.js';
import { noop } from './shared.js';

// A routine that runs on for several places and hours is no sentence for a card or a cue: only a short "doing" is quoted.
const short = text => { const said = String(text ?? '').replace(/[.!?…]+$/, ''); return said.length <= 60 && !/[;]/.test(said) ? said : ''; };
const lowerFirst = text => text.replace(/^(\p{Lu})(\p{Ll})/u, (_all, first, second) => `${first.toLowerCase()}${second}`);

/** The reader's words for why two paths crossed (the card's "Why"). `reason`: the planner's sentence for a goal ('' for a place). */
export function whyText({ name, why, reason, doing, where }) {
    if (why === 'story') return `${name} was already in the story when the cast reached them (met in the story); no roll.`;
    if (why === 'goal') return `${cutPoints(reason, MAX_REASON - 60)} Their own goal pulls them to you, so they arrive; no roll.`.trim();
    if (why === 'sought') return `You sought “${cutPoints(reason, 80)}”, and ${name} is${where ? ` at ${where}` : ' here'}. No roll.`;
    const at = where ? ` at ${where}` : '';
    const said = lowerFirst(short(doing));
    return `${name} ${said ? `${said}${at}` : `is${at || ' here'}`}, and you are there: your first time here while they are. No roll.`;
}

/** The narrator's words for why now: where they are, or what pulls them. */
export function whyNarrator(person) {
    const met = person?.met ?? {};
    if (met.why === 'sought') return `{{user}} asked for "${cutPoints(met.reason, 80)}"; they are at ${met.where || person?.where || 'this place'}, the place of this scene.`;
    if (met.why === 'goal') return `${cutPoints(met.reason, 200)} Their own goal brings them to {{user}}.`.trim().replace(/^(\p{Ll})/u, c => c.toUpperCase());
    const said = lowerFirst(short(person?.doing));
    return `${said ? `${said}, ` : ''}they are at ${met.where || person?.where || 'this place'}, the place of this scene.`.replace(/^(\p{Ll})/u, c => c.toUpperCase());
}

/**
 * Applies a `cast.meet` payload (`{ at, who: [{ key, why, reason, place? }] }`). Returns the keys met. `place`: the party's place. Someone
 * who comes by their goal is where the party is, not at their start; someone the story already had in the scene (`why: 'story'`) is met at
 * that moment and is not brought in again (no cue).
 */
export function applyMeet(cast, payload, env) {
    const { now = null, rev = 0, touch = noop, note = null, packName = pack => pack } = env;
    const met = [];
    const cued = [];
    for (const item of payload.who ?? []) {
        const person = Object.hasOwn(cast.people, item.key) && isRecord(cast.people[item.key]) ? cast.people[item.key] : null;
        if (!person || !isAlive(person) || isMet(person)) continue;
        touch(item.key);
        const reason = item.why === 'goal' || item.why === 'sought' ? cutPoints(item.reason, MAX_REASON) : '';
        const here = cutPoints(item.place, MAX_PLACE);
        // A goal arrival leaves where they were, in case the reply does not show them (`applyWithdraw`).
        // (Someone sought is already at the party's place: they do not move.)
        const arrives = item.why !== 'place' && item.why !== 'sought';
        const was = arrives && here && person.where !== here ? person.where : undefined;
        if (arrives && here) person.where = here;
        person.met = { on: isInt(now) ? now : null, where: person.where, why: item.why, reason, rev, ...(was === undefined ? {} : { was }) };
        const shown = cutPoints(whyText({ name: person.name, why: item.why, reason, doing: person.doing, where: person.where }), 400);
        met.push(item.key);
        if (item.why !== 'story') cued.push(item.key);
        if (typeof note === 'function') {
            note({
                kind: 'met', head: `Paths crossed: ${person.name}`, tag: `${packName(person.pack)} cast · ${item.why === 'story' ? 'met in the story' : 'first meeting'}`,
                rest: item.why === 'story' ? `Why: ${shown}` : `Why: ${shown} The narrator is told to bring them in; a swipe rewrites the scene, not who you meet.`,
                line: item.why === 'sought' ? `Paths crossed: ${person.name} — you sought “${cutPoints(reason, 80)}”` : `Paths crossed: ${person.name}`,
            });
        }
    }
    if (cued.length && isInt(payload.at)) cast.meeting = [{ at: payload.at, keys: cued.slice(0, 4), rev, seen: 1 }];   // `seen`: judged by who the reply had in the scene at any point (older meetings: at its end)
    return met;
}
