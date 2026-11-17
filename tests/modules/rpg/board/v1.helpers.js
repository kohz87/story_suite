// A host whose sheet is Combat Rules v1 blocks (a Character, its Skills and a Foes block), the fight kind on the port, and the calls that drive a fight through the real sdk.interaction.
import { characterV1 } from '../../../../modules/rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../../modules/rpg/templates-parts/v1-skills.js';
import { foesV1 } from '../../../../modules/rpg/templates-parts/v1-foes.js';
import { actorIdOf } from '../../../../modules/rpg/roster.js';
import { FIGHT_KIND } from '../../../../modules/rpg/board/port-session.js';
import { boardApi } from '../../../core/helpers/board-port.js';
import { buildDefinitions, newDraft, readDraft } from '../../../../modules/rpg/view/wizard-data.js';
import { CHOOSER_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { setup } from '../helpers.js';

export const HERO_ID = actorIdOf('pack.chat/character');
const stateOf = (definition, fields) => ({ definition, fields: Object.fromEntries(Object.entries(definition.state).map(([key, spec]) => [key, spec.default ?? (spec.type === 'text' ? '' : 0)])) , over: fields });

function block(role, definition, fields) {
    const made = stateOf(definition, fields);
    // (a block the chat pinned went through dm.define, which gives every list a value)
    return { role, definition: { rules: [], cards: [], ...definition }, fields: { ...made.fields, ...fields } };
}

/** `{ character, skills, foes }` blocks: Astra (level 5, 20 HP) with an attack skill, and a group of Rats (`count`, level `level`, tier `tier`). */
export function v1Blocks({ hero = {}, count = 3, level = 5, tier = 'standard', skill = true, built = false } = {}) {
    if (built) return builtBlocks({ hero, count, level, tier, skill });
    return {
        character: block('character', characterV1, { who: 'Astra', hp: 30, 'hp-max': 30, mp: 12, 'mp-max': 12, sp: 12, 'sp-max': 12, str: 14, vit: 10, agi: 10, dex: 10, int: 8, wis: 8, cha: 5, level: 5, cap: 99, ...hero }),
        skills: block('skills', skillsV1, { who: 'Astra', ...(skill ? { skill1: 'Cut', about1: 'A hard cut', stat1: 'str', type1: 'attack', practice1: 100, rank1: 1 } : {}) }),
        foes: block('foes', foesV1, { foe1: 'Rats', count1: count, level1: level, tier1: tier }),
    };
}

export async function v1Host(options = {}) {
    const made = await setup({ blocks: v1Blocks(options), board: true, planner: false });
    return made;
}

export const headSid = host => host.store.carrierSid(host.store.headIndex());
export const api = host => boardApi(host.ctx.chatMetadata, () => host.head(), headSid(host));
/** One exchange: Astra's action (`normal` attack on the first standing foe unless told otherwise). */
export const step = (choice = 'normal', args = { target: '1.1' }) => ({ inputs: [{ actor: HERO_ID, choice, args }] });
export const openFight = (host, args = {}) => api(host).open(FIGHT_KIND, { rules: {}, ...args });
export const stage = (host, input) => { const open = host.ctx.chatMetadata.storySuiteInteraction.open; return api(host).stage(open.id, input); };
export { FIGHT_KIND };

/** The same sheet as v1Blocks, but made the way the product makes it: the New character wizard's definitions (their defaults are the fields), the chooser's Foes template. */
function builtBlocks({ hero, count, level, tier, skill }) {
    const draft = readDraft({ ...newDraft({ persona: 'Astra' }), name: 'Astra', stats: { str: 10, vit: 10, agi: 10, dex: 10, int: 8, wis: 8, cha: 5 }, level,
        skills: skill ? [{ name: 'Cut', about: 'A hard cut', stat: 'str' }] : [] });
    const made = buildDefinitions(draft, { used: [] });
    made.character.slug = 'character'; made.skills.slug = 'skills';
    const foes = structuredClone(CHOOSER_TEMPLATES.find(entry => entry.definition.role === 'foes').definition);
    return { character: block('character', made.character, { ...hero }), skills: block('skills', made.skills, {}),
        foes: block('foes', foes, { foe1: 'Rats', count1: count, level1: level, tier1: tier }) };
}
