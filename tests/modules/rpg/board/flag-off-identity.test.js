// With the fight board off (and with the RPG off) a scripted chat sends the same prompts and keeps the same metadata, records and text as the build before the port did.
// The fixtures were recorded by running this same script on the commit before I6 (main with I5), not by this code. The guard mark's `;kinds:` suffix is the one accepted change (plan 2.4) and is cut before comparing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeModel, createHost } from '../../../../testkit/index.js';
import { STANDARD_TEMPLATES, characterV1For } from '../../../../modules/rpg/templates.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';

const fixture = name => JSON.parse(readFileSync(new URL(`../../../core/fixtures/${name}.json`, import.meta.url), 'utf8'));
const strip = value => JSON.parse(JSON.stringify(value).replace(/;kinds:[^"]*/g, ''));

async function run({ rpg, board }) {
    const restore = seedCrypto(42);
    const host = await createHost({ callModel: createFakeModel(Array(12).fill('')), settings: { features: { 'story-block.gear': true }, modules: { 'story-block': { rpgFormula: 'standard' } } } });
    try {
        host.features.set('story-block.rpg', rpg);
        host.features.set('story-block.fight-board', board);
        const sends = [];
        const sendOne = async (text, reply) => { const r = await host.send(text, reply); sends.push({ text, aborted: r.aborted === true, chat: (r.request?.chat ?? []).map(m => `${m.role}:${m.content}`) }); };
        await sendOne('Begin.', 'Opening.');
        for (const name of ['Character', 'Foes']) await host.sdk.command('dm.define', { definition: name === 'Character' ? characterV1For() : structuredClone(STANDARD_TEMPLATES.find(e => e.name === name).definition) });
        await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', str: 3, vit: 10, agi: 10, int: 10, health: 5, stamina: 1, mana: 1 } });
        await sendOne('Set.', 'Fight.\n<Changes>\n+ dm foes — why | kind: set-slot-1 | name: Rats | count: 3 | level: 10\n+ item Healing Draught | kind: consumable | rarity: rare | qty: 3\n</Changes>');
        await sendOne('I attack the rats.', 'The rats fight back.');
        await sendOne('I look around.', 'Nothing else moves.');
        await host.swipe('Another telling of the quiet.');
        await sendOne('I rest.', 'You rest.');
        return strip({ sends, meta: host.ctx.chatMetadata, records: host.ctx.chat.map(m => m.extra?.storySuite ?? null), text: host.ctx.chat.map(m => m.mes), problems: host.turn?.problems?.() ?? [] });
    } finally { host.close(); restore(); }
}

for (const [name, flags] of [['flag-off-rpg-off', { rpg: false, board: false }], ['flag-off-rpg-on-board-off', { rpg: true, board: false }]]) {
    test(`${name}: prompts, metadata, records and text equal the build before the port's`, async () => {
        const got = await run(flags), want = fixture(name);
        for (const key of ['sends', 'meta', 'records', 'text', 'problems']) assert.deepEqual(got[key], want[key], key);
        assert.equal(got.meta.storySuiteInteraction, undefined, 'no interaction scratch appears');
    });
}
