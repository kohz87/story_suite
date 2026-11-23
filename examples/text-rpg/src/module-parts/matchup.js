// The matchup the narrator is told each reply, read from the foes record and the members' health and stamina: `{ band, why }`, or null with no foes standing.
import { foesWeight, matchupBand, memberWeight } from '../rules/matchup.js';
import { ENERGY_STAGES, HEALTH_STAGES, stageOf } from '../words/pools.js';
import { THREAT_WORDS } from '../words/threat.js';
import { standing } from './foes-record.js';
import { poolWith } from './gear-sizes.js';
import { woundsOf } from './standing.js';

const SHORT = ['far beneath', 'beneath', 'a fair match', 'above', 'far above', 'beyond'];

/** The word for a threat that reads after a foe's name: "24 rats beneath", "6 wolves a fair match". */
export const threatShort = threat => SHORT[threat] ?? THREAT_WORDS[threat] ?? '';

/**
 * The matchup of a domain slice; `capOf(member)` gives the gear cap the stamina is read under, `now` the story minute (groups left alone for a day are gone). `why` names the foes and what is wrong with the party
 * ("24 rats beneath, Astra wounded"). Fallen and Down members count nothing.
 */
export function matchupOf(slice, capOf = () => ({}), now = null) {
    const groups = standing(slice, now).map(([, group]) => group);
    if (!groups.length) return null;
    const members = Object.values(slice?.members ?? {}).filter(member => !member.fallen);
    let party = 0;
    const notes = [];
    for (const member of members) {
        const pool = poolWith(member, 'sp', capOf(member));
        const energy = stageOf(pool.now, pool.max, 'energy').index;
        const wounds = woundsOf(member);
        party += memberWeight(wounds, energy);
        if (wounds === 5) notes.push(`${member.name} down`);
        else {
            if (wounds > 0) notes.push(`${member.name} ${HEALTH_STAGES[wounds].toLowerCase()}`);
            if (energy >= 2) notes.push(`${member.name} ${ENERGY_STAGES[energy].toLowerCase()}`);
        }
    }
    const foes = groups.map(group => `${group.left} ${group.name} ${threatShort(group.threat)}`);
    return { band: matchupBand(foesWeight(groups), party), why: [...foes, ...(notes.length ? notes.slice(0, 4) : ['the party unhurt'])].join(', ').slice(0, 160) };
}
