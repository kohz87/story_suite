import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { createFakeModel } from '../../../testkit/model.js';
import { FIGHT, FLOW_VERSION, LEAN_RPG_FEATURE, STANDARD_FORMULA, prepare, readSheet, rollPrepared } from '../../../modules/rpg/index.js';
import { STANDARD_TEMPLATES, characterV1For } from '../../../modules/rpg/templates.js';
import { success } from '../data-modules/helpers.js';
import { character, foeBlock, rollReceipt, sheetDomain, skillBlock } from './helpers.js';

const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;

// Wessel (STR 10, 6 blocks), a foe group of rats: scripted dice by kind and place in the plan.
export const party = ({ foes = [['Sluice Rats', 6, 2, 4]], wessel = {}, ren = null } = {}) => ({
    wessel: { role: 'character', fields: character('Wessel', { health: 6, str: 10, vit: 10, agi: 10, dex: 6, int: 5, luk: 9, cha: 5, soul: 2, level: 2, ...wessel }) },
    'wessel-skills': { role: 'skills', fields: skillBlock('Wessel', [['Iron Breath', 2, 'str']]) },
    ...(ren ? { ren: { role: 'character', fields: character('Ren', { health: 5, str: 5, vit: 5, agi: 8, dex: 10, int: 16, luk: 9, cha: 5, soul: 2, level: 2, ...ren }) } } : {}),
    foes: { role: 'foes', fields: foeBlock(foes) },
});
export const sheetOf = blocks => readSheet({ domains: { dataModules: sheetDomain(blocks) } });
export const dice = (table = {}, fallback = 10) => Object.assign((kind, at) => {
    const list = [...(table[`${kind}${at}`] ?? [])];
    return () => (list.length ? list.shift() : fallback);
}, { positional: true });
export const std = (over = {}) => ({ ...STANDARD_FORMULA, ...over });
export const planOf = (over = {}) => ({ formula: 'standard', pace: 'all', acts: [], foes: [], checks: [], ...over });
export const hit = { who: 'Wessel', skill: 'Iron Breath', target: 'Sluice Rats' };
export const roll = (plan, { blocks = party(), rules = std(), source = dice(), flow = FLOW_VERSION } = {}) => rollPrepared(plan, prepare(plan, sheetOf(blocks), rules, { flow }), source, rules, { flow });

export const blocksStd = () => party({ foes: [['Sluice Rats', 6, 2, 4]], ren: {} });
export const ANSWER = ['pace: all', 'act Wessel | skill: Iron Breath | type: physical | target: Sluice Rats', 'foe Sluice Rats | target: Wessel'].join('\n');
export const ONE_SIDED = ['pace: all', 'act Wessel | skill: Iron Breath | type: physical | target: Sluice Rats'].join('\n');
export const fieldsOf = (host, slug) => host.head().domains.dataModules.instances[`pack.chat/${slug}`].chat.fields;
export const resultOf = (host, index) => rollReceipt(host, index).data.v2.result;
export function same(host, label = 'a rebuild') {
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, `${label} gives the live story`);
}
export async function reloads(host) {
    const live = JSON.stringify(host.head());
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), live, 'a reload gives the live story');
    assert.deepEqual(host.store.problems(), []);
}

export const xpOf = (host, slug) => fieldsOf(host, slug).xp;
export const fightReceipts = (host, index) => host.ctx.chat[index].extra.storySuite.receipts.filter(receipt => receipt.type === FIGHT);

export async function world(t, { answers = ['none'], party = ['Astra'], xp = 0, rate } = {}) {
    const model = createFakeModel(answers);
    const host = await createHost({ callModel: model, settings: { modules: { 'story-block': { ...(rate === undefined ? {} : { rpgXpRate: rate }) } } } });
    t.after(() => host.close());
    host.features.set(LEAN_RPG_FEATURE, true);
    host.features.set('story-block.fight-board', false);
    await host.send('Begin.', 'Opening.');
    // (the narrator's XP line and the hold belong to the Character made before the marked one)
    const definitionOf = name => (name === 'Character' ? characterV1For() : structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === name).definition));
    for (const who of party) {
        const definition = definitionOf('Character');
        if (who !== party[0]) { definition.slug = who.toLowerCase(); definition.name = who; }
        success(await host.sdk.command('dm.define', { definition }));
        success(await host.sdk.command('dm.set', { module: `pack.chat/${definition.slug}`, fields: { who, level: 2, xp } }));
    }
    success(await host.sdk.command('dm.define', { definition: definitionOf('Foes') }));
    return { host, model };
}
export const slugOf = who => (who === 'Astra' ? 'character' : who.toLowerCase());
export const SLOT = '+ dm foes — why | kind: set-slot-1 | name: Mud Crawlers | count: 6 | level: 1';
export const DOWN = '~ dm foes — why | kind: hurt-1 | to: 0';
export const XP = amount => `+ dm character — why | kind: add-xp | amount: ${amount}`;
export const fields = (host, who) => host.head().domains.dataModules.instances[`pack.chat/${slugOf(who)}`].chat.fields;
