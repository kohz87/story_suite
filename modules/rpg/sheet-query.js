// The `rpg.sheet` query: one row per member of the party, for the Party tab, the Card and the Now tab. A pure read of the Character and Skills blocks (plus the worn gear's soak).
import { LEVEL, STATS_V1 } from './names.js';
import { readParty } from './view/party-data.js';
import { packLevelsOf } from './levels.js';
import { soakOf } from './combat/damage.js';
import { gearSoakRecord } from './gear.js';
import { actorIdOf } from './roster.js';
import { readSheet } from './read.js';
import { sheetSkills } from './sheet-skills.js';

const BAR_KIND = Object.freeze({ health: 'hp', mana: 'mp', stamina: 'sp' });

const bars = character => Object.entries(BAR_KIND).filter(([key]) => character.bars?.[key]).map(([key, kind]) => ({ kind, value: character.bars[key].value, max: character.bars[key].max }));

// The seven stats, WIS among them; only a Combat Rules v1 Character has them so (an earlier one has LUK for WIS: null, it has no WIS to show).
const statsOf = character => (character.v1 === true
    ? Object.fromEntries(STATS_V1.map(key => [key.toUpperCase(), character.stats.find(stat => stat.key === key)?.value ?? 0]))
    : null);

// "Lv 14 · Guild F" → "Guild F", "Rank Novice · Lv 7" → "Rank Novice": what the line says besides the level; null when it says only that.
const classOf = line => String(line ?? '').split(' · ').filter(part => !/^Lv \d+$/.test(part)).join(' · ') || null;

/** The sheet row of one party member. `gear` is the soak of the worn pieces (0 when none or unknown). */
function rowOf(character, gear) {
    const vit = character.stats.find(stat => stat.key === 'vit')?.value;
    return {
        id: actorIdOf(character.module), name: character.name, level: character.level, line: character.levelText, className: classOf(character.levelText),
        bars: bars(character), xpPct: Math.min(100, Math.round(100 * character.xp / LEVEL.xpPerLevel)), points: character.points,
        // the stance's mastery adds to it in a fight; at rest the VIT and the worn gear are all there is (combat/damage.js soakOf)
        soakPct: character.v1 === true ? soakOf(vit, 0, gear) : 0,
        // no source: nothing keeps where a companion who is away has gone (a member who left is not on the sheet), and no condition has a timer in the sheet
        away: null, effects: [],
        stats: statsOf(character), skills: sheetSkills(character.skills, character.level),
    };
}

/**
 * `rpg.sheet` → [{ id, name, level, line ("Lv 14 · Guild F"), className ("Guild F" | null), bars: [{ kind: hp|mp|sp, value, max }], xpPct, points, soakPct, away, effects, stats: { STR…CHA } | null, skills }] in the party's order (the
 * reader's own first), a member who left not among them; [] with no Character. `args.persona` names the reader. The RPG's feature gates it where registered.
 */
export function sheetQuery(state, args, tools) {
    const query = typeof tools?.query === 'function' ? tools.query : null;
    let found = null;
    try { found = packLevelsOf(query?.('packs.content', { kind: 'rpg' })); } catch { found = null; }
    const ranks = found?.ranks ?? [], playerRank = found?.playerRank ?? null;
    const party = readParty(state, { own: typeof args?.persona === 'string' ? args.persona : '', ranks, playerRank }).filter(character => character.left !== true);
    // The party's shared bag counts for the first v1 Character of the sheet (by block id, as the fight gives it: board/v1-kind.js soakOf), not for the first of the party's own order.
    const holder = readSheet(state).characters.find(character => character.v1 === true);
    const sharedFor = holder ? actorIdOf(holder.module) : null;
    return party.map(character => {
        const owners = [actorIdOf(character.module), ...(actorIdOf(character.module) === sharedFor ? ['party'] : [])];
        let gear = 0;
        try { gear = query ? gearSoakRecord(owners, owner => query('inventory.gear', { owner })).total : 0; } catch { gear = 0; }
        return rowOf(character, gear);
    });
}
