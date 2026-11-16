// Who wears what on the gear screens and how a bound piece names its member.

import { membersOf, pcOf } from '../validate.js';
import { asker } from './shared-ask.js';

export const gearIsOn = env => { try { return env.gearOn?.() === true; } catch { return false; } };

// Who wears what on the gear screens: the party's bag is the main character's (the party module's `party.pc`, else the reader's persona), the
// others are the party's members. → { names: Map(owner → name), owners: [{ value, label }] } (the main character first, as owner `party`).
export function gearWearers(state, tools, env) {
    const query = asker(tools);
    const party = state?.domains?.party ?? null;
    const members = membersOf(query, party);
    const pcId = pcOf(query, party);
    let persona = '';
    try { persona = String(env.persona?.() ?? '').trim(); } catch { persona = ''; }
    const own = (pcId && members.find(member => member.id === pcId)?.name) || persona || 'The party';
    const names = new Map([['party', own], ...members.map(member => [member.id, member.name])]);
    return { names, owners: [{ value: 'party', label: own }, ...members.filter(member => member.id !== pcId).map(member => ({ value: member.id, label: member.name }))] };
}

// (how a bound piece names its member: the party's roster, else the ID; only asked with gear on)
export function boundNames(state, tools, env) {
    if (!gearIsOn(env)) return null;
    let names = null;
    return id => {
        if (!names) { try { names = gearWearers(state, tools, env).names; } catch { names = new Map(); } }
        return names.get(id);
    };
}
