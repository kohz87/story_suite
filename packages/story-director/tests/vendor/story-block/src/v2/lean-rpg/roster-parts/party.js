// Builds the party roster of a state and the `party.actors` / `party.pc` fallback queries.
import { fold, readSheet, sameWho } from '../read.js';
import { actorIdOf } from './actor-id.js';

/**
 * The roster of a state: `{ actors: [{ id, name, pc? }], pc }` (`pc`: the reader's actor id, or null). `persona` is the reader's name. The reader is the Character named
 * like the persona; with none named so, the only Character when there is just one; with several and none named so, nobody (`pc` null: nothing guesses who the reader is;
 * the rolls fall back to the first block themselves). Two blocks could in theory meet on one id (8 base-36 characters, about 2.8e12 of them: for the dozen blocks a chat
 * may hold the chance is of the order of 1e-10); that is not handled, the later block simply shares the actor.
 */
export function rosterOf(state, persona = '') {
    const sheet = readSheet(state);
    const actors = sheet.characters.map(character => ({ id: actorIdOf(character.module), name: character.who, character }));
    const reader = String(persona ?? '').replace(/\s+/g, ' ').trim();
    const named = reader ? actors.find(actor => actor.character.key === fold(reader)) ?? actors.find(actor => sameWho(actor.character, reader, [], sheet.characters)) : null;
    const lead = named ?? (actors.length === 1 ? actors[0] : null);
    return { actors: actors.map(actor => ({ id: actor.id, name: actor.name, ...(actor === lead ? { pc: true } : {}) })), pc: lead ? lead.id : null };
}

/**
 * The two queries (registered as fallbacks), for a persona reader `persona()`. They answer while the RPG is on and Gear in fights is on (`on()`), or whenever asked with
 * `recorded: true` (a roll that carries a gear record works its gear out by what was, not by today's switches: the same as `inventory.gear`), so no `feature` is set on them.
 * They read the state alone (plus the persona's name).
 */
export function rosterQueries({ persona = () => '', on = () => true } = {}) {
    const who = () => { try { return persona(); } catch { return ''; } };
    const answering = args => { if (args?.recorded === true) return true; try { return on() === true; } catch { return false; } };
    return {
        'party.actors': Object.assign((state, args) => { if (!answering(args)) return null; const { actors } = rosterOf(state, who()); return actors.length ? actors : null; }, { fallback: true }),
        'party.pc': Object.assign((state, args) => { if (!answering(args)) return null; const { pc } = rosterOf(state, who()); return pc ? { id: pc } : null; }, { fallback: true }),
    };
}
