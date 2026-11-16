// QA: a small seeded shard that makes a legacy line claim a key the line already holds, so the replay skip (REPLAY.md rule 4)
// is exercised by a fuzz, not only a directed case. It is separate from state-fuzz-1..5 so their seeds draw the same chats.
// Each run: a few replies, each maybe with `! probe <word>`; then the first reply is edited to take a word a later one holds
// and re-read; after every step the store equals the oracle's rebuild (helpers/oracle.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { prng, seedCrypto } from './helpers/seeded.js';
import { checkInvariants } from './helpers/oracle.js';
import { probeModule } from './helpers/probe-module.js';

const WORDS = ['ember', 'frost', 'gale'];
const reply = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

for (const seed of [2, 5, 8, 13]) {
    test(`claim fuzz seed ${seed}: a legacy line claiming a held key is skipped, store equals oracle`, async t => {
        t.mock.method(console, 'warn', () => {});
        const restore = seedCrypto(seed);
        t.after(restore);
        const r = prng(seed);
        const h = await createHost({ modules: [probeModule()] });
        t.after(() => h.close());
        const word = r.pick(WORDS);
        await h.send('On.', reply('R0.', ['+ item Rope']));
        for (let step = 1; step <= 3; step++) {
            await h.send('On.', reply(`R${step}.`, [`+ item ${r.pick(['Lamp', 'Apple', 'Torch'])}`, ...(step === 1 || r.chance(0.5) ? [`! probe ${step === 1 ? word : r.pick(WORDS)}`] : [])]));
        }
        checkInvariants(h, 'before the edit');
        await h.st.editMessage(2, reply('R0.', ['+ item Rope', `! probe ${word}`]));
        assert.equal((await h.sdk.reread(2)).ok, true);
        assert.ok(h.store.problems().some(p => /claim already held/.test(p.why)), 'the later claim is skipped with a Problem');
        checkInvariants(h, 'after the edited Re-read');
        h.store.rebuild();
        checkInvariants(h, 'after a rebuild');
    });
}
