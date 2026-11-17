// Join: the card a person's People page offers ("Add to party"): the same card a `+ party` line gives, for someone the story already holds.

import { oneLine } from '../../../core/text.js';
import { DM_LIMITS } from '../../data-modules/schema.js';
import { castSkillsOf } from '../../../packs/cast-skills.js';
import { PARTY_ACTIVE } from '../names.js';
import { checkJoin } from './check.js';
import { joinCard } from './card.js';
import { readJoin } from './line.js';
import { joinRules } from './draft.js';
import { soulNaming } from './party.js';

/**
 * What "Add to party" offers for `name` in a state: `{ name, soul, best, card }` (`card`: joinCard's, for the offer `{ name, soul, best }`; the dossier
 * knows no class or best stat (`cast`: the packs' cast entries, for a cast member's signature skills), so the offer starts at the first class with no best stat) or null when the person may not join: not You (`isMe`), in the
 * party already or one who left (that is a return, the party's business), no room for 4 active, or no room for the two blocks.
 */
export function partyAdd(state, name, isMe = () => false, cast = []) {
    const read = readJoin({ op: '+', name, labels: {} }, soulNaming(state), joinRules(state));
    if (read.error || isMe(read.name)) return null;
    const check = checkJoin(state, read, DM_LIMITS, PARTY_ACTIVE);
    if (!check.ok || check.returning) return null;
    // (a cast member's signature skills, as the pack has them, go with Edit first exactly as on a reply's card: offers.js)
    let found = null;
    try { found = castSkillsOf([{ content: { cast: Array.isArray(cast) ? cast : [] } }], read.name); } catch { found = null; }
    const skills = (found?.skills ?? []).slice(0, 8).map(skill => ({ name: oneLine(skill?.name), about: oneLine(skill?.about), stat: skill?.stat, uses: skill?.uses, rank: skill?.rank, ...(skill?.type === 'utility' ? { type: 'utility' } : {}) }));
    const offer = { name: read.name, soul: 1, best: read.best, ...(skills.length ? { skills } : {}) };
    return { ...offer, card: joinCard([offer], state, isMe) };
}
