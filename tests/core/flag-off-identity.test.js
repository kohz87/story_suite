// With the RPG off (and with it on but no fight played) a scripted chat sends the same prompts and keeps the same metadata, records and text as the build before Combat C11 did.
// The fixtures were recorded by running this same script on the commit before C11 (combat/v1-only), not by this code. The guard mark's `;kinds:` suffix is cut before comparing.
// NB-1 (LIVEF4B) re-recorded flag-off-v1-rpg-on for its two intended changes only: "I look around." (foes standing unplayed) gets the start and story-goes-on lines, and "I rest." (the second
// message past the fight) lapses the Rats with a prelude after the unchanged dice. Everything else is the pre-C11 recording.
// HORDE (21 Nov) re-recorded both for the Foes block's horde line only: its grammar line, the start line's horde sentence (RPG on), the block's three horde fields in its generic
// state line (RPG off: "waves 0; hold none; leader \"\""), its definition's fields, kind (with its slot-set condition) and clears, and the block ids that follow from the definition's hash.
// STATPAIRS re-recorded both for the bars from stat pairs only: the v1 Character's HP and SP size rules (HP from STR+VIT, SP from AGI+DEX), Astra's hp 10 → 8 (STR 3,
// VIT 10), and the ids, hashes, reads and visit counts that follow from those rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeModel, createHost } from '../../testkit/index.js';
import { CHOOSER_TEMPLATES } from '../../modules/rpg/templates.js';
import { seedCrypto } from '../suite/qa/helpers/seeded.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const strip = value => JSON.parse(JSON.stringify(value).replace(/;kinds:[^"]*/g, ''));

// (the Problems list kept with the chat, storySuiteProblems, is no part of what C11 left unchanged: the problems are compared below)
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
        return strip({ sends, meta: Object.fromEntries(Object.entries(host.ctx.chatMetadata).filter(([key]) => key !== 'storySuiteProblems')), records: host.ctx.chat.map(m => m.extra?.storySuite ?? null), text: host.ctx.chat.map(m => m.mes), problems: (host.turn?.problems?.() ?? []).filter(item => item.code !== 'NO_CHANGES') });
    } finally { host.close(); restore(); }
}

for (const [name, rpg] of [['flag-off-v1-rpg-off', false], ['flag-off-v1-rpg-on', true]]) {
    test(`${name}: prompts, metadata, records and text equal the build before C11's`, async () => {
        const got = await run(rpg), want = fixture(name);
        for (const key of ['sends', 'meta', 'records', 'text', 'problems']) assert.deepEqual(got[key], want[key], key);
    });
}
