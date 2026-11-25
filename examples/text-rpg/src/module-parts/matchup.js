// The matchup the narrator is told each reply, read from the foes record and the members' health and stamina: `{ band, why }`, or null with no foes standing.
import { foesWeight, matchupBand, memberWeight } from '../rules/matchup.js';
import { ENERGY_STAGES, HEALTH_STAGES, stageOf } from '../words/pools.js';
import { foeLine } from '../words/foe-kinds.js';
import { standing } from './foes-record.js';
import { poolWith } from './gear-sizes.js';
import { woundsOf } from './standing.js';

/**
 * The matchup of a domain slice; `capOf(member)` gives the gear cap the stamina is read under, `now` the story minute (groups left alone for a day are gone). `why` names the foes and what is wrong with the party
 * ("Rats: vermin, minor for you (24), Astra wounded"). Fallen and Down members count nothing.
 */
export function matchupOf(slice, capOf = () => ({}), now = null) {
    const groups = standing(slice, now).map(([, group]) => group);
    if (!groups.length) return null;
    const members = Object.values(slice?.members ?? {}).filter(member => !member.fallen);
    let party = 0;
    const notes = [];
    for (const member of members) {
        // (a companion has no stamina sheet: never read as tired)
        const pool = member.companion ? null : poolWith(member, 'sp', capOf(member));
        const energy = pool ? stageOf(pool.now, pool.max, 'energy').index : 0;
        const wounds = woundsOf(member);
        party += memberWeight(wounds, energy);
        if (wounds === 5) notes.push(`${member.name} down`);
        else {
            if (wounds > 0) notes.push(`${member.name} ${HEALTH_STAGES[wounds].toLowerCase()}`);
            if (energy >= 2) notes.push(`${member.name} ${ENERGY_STAGES[energy].toLowerCase()}`);
        }
    }
    const foes = groups.map(group => foeLine(group.name, group.kind, group.threat, group.left));
    return { band: matchupBand(foesWeight(groups), party), why: [...foes, ...(notes.length ? notes.slice(0, 4) : ['the party unhurt'])].join(', ').slice(0, 160) };
}
