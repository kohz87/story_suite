// Join: the card a person's People page offers ("Add to party"): the same card a `+ party` line gives, for someone the story already holds.

import { oneLine } from '../../../core/text.js';
import { DM_LIMITS } from '../../data-modules/schema.js';
import { castSkillsOf } from '../../../packs/cast-skills.js';
import { typeKey } from '../../../core/runtime/skill-slots.js';
import { PARTY_ACTIVE } from '../names.js';
import { checkJoin } from './check.js';
import { joinCard } from './card.js';
import { readJoin } from './line.js';
import { soulNaming } from './party.js';
import { pullOf } from './from-person.js';
import { levelCapFor } from '../rules-parts/levels.js';
import { packLevelsOf } from '../levels-parts/pack-levels.js';

/**
 * What "Add to party" offers for `name` in a state: `{ name, soul, best, card }` (`card`: joinCard's, for the offer `{ name, soul, best }`; the dossier
 * knows no class or best stat, so the offer starts at the first class, or at the level and best stat their NPC State record gives; `cast`: the packs' cast entries, a format 3 cast member's signature skills; `pull`, `cap`: the game's rpg.pull record and the level cap) or null when the person may not join: not You (`isMe`), in the
 * party already or one who left (that is a return, the party's business), no room for 4 active, or no room for the two blocks.
 */
export function partyAdd(state, name, isMe = () => false, cast = [], { pull = null, cap = null } = {}) {
    const read = readJoin({ op: '+', name, labels: {} }, soulNaming(state));
    if (read.error || isMe(read.name)) return null;
    const check = checkJoin(state, read, DM_LIMITS, PARTY_ACTIVE);
    if (!check.ok || check.returning) return null;
    // (what their NPC State record gives the sheet goes with Edit first exactly as on a reply's card, offers.js; with no abilities of theirs, a format 3 cast member's signature skills stand, X1 removes that)
    let found = null;
    try { found = castSkillsOf([{ content: { cast: Array.isArray(cast) ? cast : [] } }], read.name); } catch { found = null; }
    const pulled = pullOf(state, { name: read.name, soul: read.soul, best: read.best, pull, cap, fallback: found?.skills ?? [] });
    const skills = pulled.skills.slice(0, 8).map(skill => ({ name: oneLine(skill?.name), about: oneLine(skill?.about), stat: skill?.stat, uses: skill?.uses, rank: skill?.rank, ...typeKey(skill?.type) }));
    const offer = { name: read.name, soul: 1, best: pulled.best, ...(pulled.level ? { level: pulled.level } : {}), ...(skills.length ? { skills } : {}) };
    return { ...offer, card: joinCard([offer], state, isMe) };
}

/** The `rpg.partyAdd` query's function for the part (`isMe`: whether a name is the reader's own): `{ name }` → partyAdd with the packs' cast, the game's rpg.pull record and the level cap (the reader's setting, the game's ranks record, 99). */
export const partyAddQuery = isMe => (state, args, tools) => {
    const ask = (kind) => { try { const got = tools?.query?.('packs.content', { kind }); return Array.isArray(got) ? got : []; } catch { return []; } };
    const records = ask('rpg');
    let values = null;
    try { values = typeof tools?.settings === 'function' ? tools.settings() : null; } catch { values = null; }
    return partyAdd(state, args?.name, isMe, ask('cast'), { pull: records.find(record => record?.slug === 'pull'), cap: levelCapFor(values, packLevelsOf(records)?.levelCap) });
};
