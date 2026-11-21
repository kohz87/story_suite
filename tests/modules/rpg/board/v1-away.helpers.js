// A two-hero v1 host (Astra and Ren) whose chat has an `away` domain stand-in (what NPC State's away part keeps): Ren away, or back (a `home` mark), or nobody.
import { characterV1 } from '../../../../modules/rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../../modules/rpg/templates-parts/v1-skills.js';
import { actorIdOf } from '../../../../modules/rpg/roster.js';
import { v1Blocks, HERO_ID } from './v1.helpers.js';
import { setup } from '../helpers.js';

export { HERO_ID };
export const REN_ID = actorIdOf('pack.chat/ren');
const make = (role, definition, over) => ({ role, definition: { rules: [], cards: [], ...definition }, fields: { ...Object.fromEntries(Object.entries(definition.state).map(([key, spec]) => [key, spec.default ?? (spec.type === 'text' ? '' : 0)])), ...over } });
export const record = (name, extra = {}) => ({ name, doing: 'scouting the north road', since: 0, back: null, steps: [], rev: 1, ...extra });

/** `away`: the stand-in domain's records by id; `foes`: the Foes block's group; `settings`: Story Block's bucket (the part's own queries read it). */
export async function twoHeroes({ away = {}, foes = { count: 1, level: 5 }, hero = { str: 30 }, settings = {}, queries = {} } = {}) {
    const blocks = v1Blocks({ ...foes, hero });
    blocks.ren = make('character', characterV1, { who: 'Ren', hp: 30, 'hp-max': 30, mp: 12, 'mp-max': 12, sp: 12, 'sp-max': 12, str: 14, vit: 10, agi: 10, dex: 10, int: 8, wis: 8, cha: 5, level: 2, cap: 99 });
    blocks['ren-skills'] = make('skills', skillsV1, { who: 'Ren', skill1: 'Cut', about1: 'A hard cut', stat1: 'str', type1: 'attack', practice1: 100, rank1: 1 });
    return (await setup({ blocks, board: true, planner: false, settings, queries, domains: { away: { initial: () => ({ away }) } } })).host;
}
export const renXp = host => host.head().domains.dataModules.instances['pack.chat/ren'].chat.fields.xp;
export const astraXp = host => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.xp;
