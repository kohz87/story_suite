// A Re-read of a won fight reply leaves every domain as it was, also the ids Story Director makes from the reply's Source (a hook offer's write id).
// Before: the Re-read counted its blocks on from the fight's own ordinals, so the write id changed on each Re-read (same length, a new id). Unedited, grown, shrunk, swipe and back, reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { CORE_FEATURE } from '../../packages/story-block/src/v2/features.js';
import { STANDARD_TEMPLATES, characterV1For } from '../../packages/story-block/src/v2/lean-rpg/templates.js';
import { STANDARD_FORMULA } from '../../packages/story-block/src/v2/lean-rpg/rules.js';
import { readSheet } from '../../packages/story-block/src/v2/lean-rpg/read.js';
import { discardBoard, openBoard, stageExchange } from '../../packages/story-block/tests/v2/helpers/board-port.js';
import { seedCrypto } from '../../packages/story-block/tests/v2/qa/helpers/seeded.js';
import { createModule } from '../../packages/story-director/src/v2/module.js';

const STORY = 'Done.\n<Changes>\n~ time June 3, 1200, 08:00 am\n+ hook Lost Letter — Orsa lost a letter | giver: Orsa | goal: Find the letter\n</Changes>';

async function world() {
    let host;
    host = await createHost({ modules: [createModule({ host: { settings: id => host.sdk?.settings(id) ?? null, substitute: text => host.sdk?.substitute(text) } })],
        callModel: async () => 'none', settings: { modules: { 'story-block': { rpgFormula: 'standard' } } } });
    host.features.set(CORE_FEATURE.leanRpg, true);
    host.features.set(CORE_FEATURE.fightBoard, true);
    await host.send('Begin.', 'Opening.');
    for (const { definition } of STANDARD_TEMPLATES) assert.equal((await host.sdk.command('dm.define', { definition: structuredClone(definition.role === 'character' ? characterV1For() : definition) })).ok, true);
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', level: 1, str: 20, agi: 20, vit: 20, health: 5 } })).ok, true);
    await host.send('Rats.', 'Rats.\n<Changes>\n+ dm foes — rats | kind: set-slot-1 | name: Tunnel Rat | count: 1 | level: 1\n</Changes>');
    return host;
}
// stage attacks until the fight is won (another seed by discarding), then send them with the reply
async function winWith(host, story) {
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex()), rules = { ...STANDARD_FORMULA, levelDivisor: 5 };
    for (let attempt = 0; attempt < 100; attempt += 1) {
        assert.equal(openBoard(meta, host.head(), { sid, rules }).error, undefined);
        let preview;
        for (let n = 0; n < 12; n += 1) {
            const target = readSheet(preview?.state ?? host.head()).foes.find(foe => foe.filled && foe.hurt > 0)?.slot;
            const staged = stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target }]);
            if (staged.error) break;
            preview = staged.preview;
            if (preview.result.stop !== 'open') break;
        }
        if (preview?.result.stop === 'won') return host.send('I strike.', story);
        discardBoard(meta);
    }
    throw new Error('no win found');
}

test('a Re-read of a won fight reply (unedited, grown, shrunk), a swipe and back and a reload leave every domain as it was', async () => {
    const restore = seedCrypto(77);
    const host = await world();
    try {
        await winWith(host, STORY);
        const index = host.ctx.chat.length - 1, live = structuredClone(host.head().domains);
        assert.equal(Object.keys(live.director.writes).length, 1, 'the hook offer made one write');
        const same = label => assert.deepEqual(host.head().domains, live, label);
        assert.equal((await host.sdk.reread(index)).ok, true);
        same('Re-read');
        const text = host.ctx.chat[index].mes;
        await host.st.editMessage(index, `${text}\nMore words.`);
        assert.equal((await host.sdk.reread(index)).ok, true);
        same('Re-read grown');
        await host.st.editMessage(index, text);
        assert.equal((await host.sdk.reread(index)).ok, true);
        same('Re-read shrunk');
        await host.swipe('Told again.');
        await host.st.swipeTo(index, 0);
        same('swipe back');
        assert.equal((await host.sdk.reread(index)).ok, true);
        same('Re-read after swipe back');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'reread-fight-writes-reload');
        host.ctx.chatMetadata = meta;
        same('reload');
    } finally { host.close(); restore(); }
});
