// With the RPG off (and with it on but no fight played) a scripted chat sends the same prompts and keeps the same metadata, records and text as the build before Combat C11 did.
// The fixtures were recorded by running this same script on the commit before C11 (combat/v1-only), not by this code. The guard mark's `;kinds:` suffix is cut before comparing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeModel, createHost } from '../../testkit/index.js';
import { CHOOSER_TEMPLATES } from '../../modules/rpg/templates.js';
import { seedCrypto } from '../suite/qa/helpers/seeded.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const strip = value => JSON.parse(JSON.stringify(value).replace(/;kinds:[^"]*/g, ''));

async function run(rpg) {
    const restore = seedCrypto(42);
    const host = await createHost({ callModel: createFakeModel(Array(12).fill('')), settings: { features: { 'story-block.gear': true } } });
    try {
        host.features.set('story-block.rpg', rpg);
        const sends = [];
        const sendOne = async (text, reply) => { const r = await host.send(text, reply); sends.push({ text, aborted: r.aborted === true, chat: (r.request?.chat ?? []).map(m => `${m.role}:${m.content}`) }); };
        await sendOne('Begin.', 'Opening.');
        for (const name of ['Character', 'Foes']) await host.sdk.command('dm.define', { definition: structuredClone(CHOOSER_TEMPLATES.find(e => e.name === name).definition) });
        await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', str: 3, vit: 10, agi: 10, int: 10 } });
        await sendOne('Set.', 'Fight.\n<Changes>\n+ dm foes — why | kind: set-slot-1 | name: Rats | count: 3 | level: 10\n+ item Healing Draught | kind: consumable | rarity: rare | qty: 3\n</Changes>');
        await sendOne('I attack the rats.', 'The rats fight back.');
        await sendOne('I look around.', 'Nothing else moves.');
        await host.swipe('Another telling of the quiet.');
        await sendOne('I rest.', 'You rest.');
        return strip({ sends, meta: host.ctx.chatMetadata, records: host.ctx.chat.map(m => m.extra?.storySuite ?? null), text: host.ctx.chat.map(m => m.mes), problems: host.turn?.problems?.() ?? [] });
    } finally { host.close(); restore(); }
}

for (const [name, rpg] of [['flag-off-v1-rpg-off', false], ['flag-off-v1-rpg-on', true]]) {
    test(`${name}: prompts, metadata, records and text equal the build before C11's`, async () => {
        const got = await run(rpg), want = fixture(name);
        for (const key of ['sends', 'meta', 'records', 'text', 'problems']) assert.deepEqual(got[key], want[key], key);
    });
}
