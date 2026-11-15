import assert from 'node:assert/strict';
import { STANDARD_FORMULA } from '../../../../src/v2/lean-rpg/rules.js';
import { openBoard, stageExchange } from '../../../../src/v2/lean-rpg/board/session.js';
import { planGear } from '../../../../src/v2/lean-rpg/gear.js';
import { readSheet } from '../../../../src/v2/lean-rpg/read.js';
import { STANDARD_TEMPLATES, characterV1For } from '../../../../src/v2/lean-rpg/templates.js';
import { createFakeModel, createHost } from '../../../../testkit/index.js';
import { actorIdOf } from '../../../../src/v2/lean-rpg/roster.js';

export async function gearHost() {
    const host = await createHost({ callModel: createFakeModel(Array(10).fill('')), settings: { features: { 'story-block.gear': true }, modules: { 'story-block': { rpgFormula: 'standard' } } } });
    host.features.set('story-block.rpg', true);
    host.features.set('story-block.fight-board', true);
    await host.send('Begin.', 'Opening.');
    for (const name of ['Character', 'Foes']) await host.sdk.command('dm.define', { definition: (name === 'Character' ? characterV1For() : structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === name).definition)) });
    await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', str: 3, dex: 12, agi: 10, vit: 20 } });
    await host.send('Set.', 'Fight.\n<Changes>\n+ dm foes — why | kind: set-slot-1 | name: Rats | count: 6 | level: 60\n+ item Cane Sword | kind: weapon | rarity: rare | DEX: +2 | equipped: weapon\n</Changes>');
    return host;
}

export function openWithGear(host) {
    const state = host.head(), query = (name, args) => host.sdk.query(name, args);
    const gear = planGear(readSheet(state), query), weapon = query('inventory.gear', { owner: 'party' }).slots.weapon;
    return openBoard(host.ctx.chatMetadata, state, { sid: host.store.carrierSid(host.store.headIndex()), rules: { ...STANDARD_FORMULA, levelDivisor: 5 }, gear, weapons: { astra: weapon } });
}

export async function potionHost({ rpg = true, health = 1 } = {}) {
    const host = await createHost({ callModel: createFakeModel(Array(10).fill('')), settings: { features: { 'story-block.gear': true }, modules: { 'story-block': { rpgFormula: 'standard' } } } });
    host.features.set('story-block.rpg', rpg);
    host.features.set('story-block.fight-board', true);
    await host.send('Begin.', 'Opening.');
    for (const name of ['Character', 'Foes']) await host.sdk.command('dm.define', { definition: (name === 'Character' ? characterV1For() : structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === name).definition)) });
    await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', str: 3, vit: 10, agi: 10, int: 10, health, stamina: 1, mana: 1 } });   // (the sheet's bars: Health 6, Stamina 5, Mana 5)
    await host.send('Set.', 'Fight.\n<Changes>\n+ dm foes — why | kind: set-slot-1 | name: Rats | count: 2 | level: 10\n+ item Healing Draught | kind: consumable | rarity: rare | qty: 3\n+ item Mana Potion | kind: consumable | rarity: common | qty: 1\n+ item Travel Ration | kind: consumable | rarity: epic | qty: 1\n</Changes>');
    return host;
}
export const fieldOf = (host, field) => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields[field];
export const stackOf = (host, name) => { const inv = host.head().domains.inventory; return Object.values(inv.stacks).find(stack => inv.defs[stack.def].name === name); };
export const ASTRA = actorIdOf('pack.chat/character');
export const itemRounds = host => host.ctx.chat.at(-1).extra.storySuite.receipts.find(item => item.type === 'rpg.resolve').data.v2.result;

export const potionBoard = (host, actions, more = []) => {
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    assert.equal(openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } }).error, undefined);
    for (const exchange of [actions, ...more]) { const staged = stageExchange(meta, host.head(), exchange); assert.equal(staged.error, undefined, staged.error); }
    return meta;
};
export const DRAUGHT = host => ({ who: 'Astra', kind: 'item', stack: stackOf(host, 'Healing Draught').id, target: 'Astra' });
