// A real host with the fight kind registered under a test module, a party of one (Astra) and Rats to fight; the pre-port board's own opening for comparison.
import { fightKind } from '../../../../src/v2/lean-rpg/board/interaction.js';
import { STANDARD_FORMULA } from '../../../../src/v2/lean-rpg/rules.js';
import { STANDARD_TEMPLATES, characterV1For } from '../../../../src/v2/lean-rpg/templates.js';
import { actorIdOf } from '../../../../src/v2/lean-rpg/roster.js';
import { createFakeModel, createHost } from '../../../../testkit/index.js';

export const FX = 'fx';
export const FX_KIND = `${FX}/fight`;
export const ASTRA_ID = actorIdOf('pack.chat/character');
export const RULES = { ...STANDARD_FORMULA, levelDivisor: 5 };
const fxModule = { id: FX, name: 'Fight probe', version: '0.0.0', interactions: { fight: fightKind } };

export async function fxHost({ gear = false, health = 5, count = 3 } = {}) {
    const host = await createHost({ modules: [fxModule], callModel: createFakeModel(Array(10).fill('')), settings: { features: { 'story-block.gear': true }, modules: { 'story-block': { rpgFormula: 'standard' } } } });
    host.features.set('story-block.rpg', true);
    host.features.set('story-block.fight-board', true);
    await host.send('Begin.', 'Opening.');
    for (const name of ['Character', 'Foes']) await host.sdk.command('dm.define', { definition: (name === 'Character' ? characterV1For() : structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === name).definition)) });
    await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', str: 3, vit: 10, agi: 10, int: 10, health, stamina: 1, mana: 1, ...(gear ? { dex: 12 } : {}) } });
    await host.send('Set.', `Fight.\n<Changes>\n+ dm foes — why | kind: set-slot-1 | name: Rats | count: ${count} | level: 10\n+ item Healing Draught | kind: consumable | rarity: rare | qty: 3${gear ? '\n+ item Cane Sword | kind: weapon | rarity: rare | DEX: +2 | equipped: weapon' : ''}\n</Changes>`);
    return host;
}
/** An action of the pre-port board as the port's input (the actor's id; `who` and the rest travel in `args`). */
export const inputOf = ({ kind, ...args }) => ({ actor: ASTRA_ID, choice: kind, args });
export const stepOf = (...actions) => ({ inputs: actions.map(inputOf) });
