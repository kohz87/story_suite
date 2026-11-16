// Plans the gear of the party: whether gear is on, and the record of what each member wears and carries; also re-exports sameWho.
import { fold, sameWho } from '../read.js';
import { actorIdOf } from '../roster.js';
import { GEAR_VERSION } from './shared-marks.js';
import { MEMBERS_MAX, OWN_MAX } from './shared-caps.js';
import { isObject, ask } from './shared-helpers.js';
import { dressOf } from './dress.js';

export { sameWho };

/** Whether gear is on for a roll: the inventory answers (`query(name, args)`) and there is a Character to dress. */
export function gearIsOn(sheet, query) {
    return typeof query === 'function' && Boolean(sheet?.characters?.length) && ask(query, 'inventory.gear', { owner: 'party' })?.on === true;
}

/**
 * The gear of every member of `sheet` (readSheet's), as the inventory reports it through `query(name, args)`: the record a roll keeps, or null
 * while gear is off (the inventory answers nothing) or there is no one to dress.
 */
export function planGear(sheet, query, reader = '') {
    if (typeof query !== 'function' || !sheet?.characters?.length) return null;
    const party = ask(query, 'inventory.gear', { owner: 'party' });
    if (!isObject(party) || party.on !== true) return null;
    const actors = ask(query, 'party.actors', {});
    const members = Array.isArray(actors) ? actors.filter(actor => typeof actor?.id === 'string' && actor.id !== 'party') : [];
    // The shared bag (`party`) is the reader's own Character's: the one the party module names (`party.pc`: its actor is the block's, or, for a module of another
    // make, the one of that name), else the one named like the reader (`reader`: the name a roll made by 2.18.0 carries as `lead`); only when none matches the
    // first block (a companion who sorts first is not the reader).
    const pc = ask(query, 'party.pc', {});
    const pcName = typeof pc?.id === 'string' ? members.find(actor => actor.id === pc.id)?.name : '';
    const matching = name => (name ? sheet.characters.findIndex(character => sameWho(character, name, [], sheet.characters)) : -1);
    const lead = Math.max(0, [typeof pc?.id === 'string' ? sheet.characters.findIndex(character => actorIdOf(character.module) === pc.id) : -1, matching(pcName), matching(reader)].find(at => at >= 0) ?? 0);
    const who = {};
    for (const [at, character] of sheet.characters.slice(0, MEMBERS_MAX).entries()) {
        // (their actor is the one whose ID is the block's; for a roster of another make an exact name wins, then a first name or an alias that means this Character alone: sameWho)
        const named = members.find(actor => actor.id === actorIdOf(character.module))
            ?? members.find(actor => fold(actor.name) === character.key)
            ?? members.find(actor => sameWho(character, actor.name, actor.aliases, sheet.characters));
        const own = [...(named ? [named.id] : []), ...(at === lead ? ['party'] : [])];
        who[character.key] = { own: own.slice(0, OWN_MAX), ...dressOf(own, party, (owner) => (owner === 'party' ? party : ask(query, 'inventory.gear', { owner }))) };
    }
    return { v: GEAR_VERSION, who };
}
