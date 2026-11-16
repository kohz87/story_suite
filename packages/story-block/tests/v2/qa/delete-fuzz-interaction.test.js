// QA: seeded chats with the test-only probe interaction kind (helpers/probe-interaction.js): open, stage, auto, send and discard, replies, swipes,
// regenerates, middle and last deletes, Re-reads and reloads, on the real host. After every move: a reload (the real store replays every guarded block
// by its guard) gives the state the live store had, the session in the metadata is true to the line, no Problem is a failure, and what each settle
// block holds is what its stored payload plays again. A failing seed replays exactly (QA_IA_SEED=n).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../src/v2/persist.js';
import { prng, seedCrypto } from './helpers/seeded.js';
import { interactionOp } from './helpers/state-fuzz-gen.js';
import { GO, IA_KIND, WAIT, activeSettles, box, iaApi, iaModule, playSegment, setText, withLines } from './helpers/probe-interaction.js';

const SEEDS = process.env.QA_IA_SEED ? [Number(process.env.QA_IA_SEED)] : [3, 7, 11, 19, 23, 31];
const MOVES = 24;
const plain = value => JSON.parse(JSON.stringify(value));
// What the seeds reached (a fuzz that never settles proves nothing): checked once all the seeds ran.
const reached = { runs: 0, settles: 0, takenBack: 0, derived: 0, replanned: 0 };

async function run(t, seed) {
    seedCrypto(t, seed);
    const r = prng(seed);
    const host = await createHost({ modules: [iaModule()] });
    const api = iaApi(host), trace = [];
    t.after(() => host.close());
    await host.send('Hello.', withLines('A.', ['! ia lamp1']));
    const carrierIndexes = () => host.ctx.chat.flatMap((message, index) => (!message.is_user && readRecord(message) ? [index] : []));
    const dropAt = async index => { await host.st.deleteMessage(index); if (host.ctx.chat[index - 1]?.is_user) await host.st.deleteMessage(index - 1); };
    const check = async label => {
        const live = plain(host.head()), open = box(host)?.open;
        await host.turn.onChatChanged();   // the real replay of every block by its guard
        assert.deepEqual(plain(host.head()), live, `${label}: a reload gives the live state\n${trace.join('\n')}`);
        const failed = host.turn.problems().filter(item => item.code === 'FAILED');
        assert.deepEqual(failed, [], `${label}: no failure\n${trace.join('\n')}`);
        if (open) {
            const sid = new Set(carrierIndexes().map(index => readRecord(host.ctx.chat[index]).sid));
            const now = box(host)?.open;
            assert.ok(!now || now.invalidated || sid.has(now.anchor), `${label}: the open session's reply is on the line\n${trace.join('\n')}`);
        }
        // Each settle block on the line plays again from its stored payload to the result it holds (a recorded result is never re-rolled).
        const bag = activeSettles(host).reduce((sum, item) => sum + item.result.total, 0);
        assert.equal(host.head().domains.ia.bag, bag, `${label}: the bag is exactly the settled changes\n${trace.join('\n')}`);
    };
    for (let step = 0; step < MOVES; step += 1) {
        const open = box(host)?.open ?? null, have = { open: Boolean(open), staged: Boolean(open?.steps?.length) };
        const move = interactionOp(r, have);
        trace.push(`${step}: ${move}`);
        const list = carrierIndexes(), head = list.at(-1);
        switch (move) {
            case 'reply': await host.send(`go${step}`, withLines(`R${step}.`, [r.pick(['! ia lamp1', '! ia luck1', '! ia luck2', '! ia lamp1'])])); break;
            case 'segment': if (!open?.invalidated && !host.ctx.chat.at(-1)?.is_user) await playSegment(host, api, r.chance(0.7) ? GO : WAIT, `go${step}`, `S${step}.`); break;
            case 'open': api.open(IA_KIND); break;
            case 'stage': if (!open.invalidated) api.stage(open.id, r.chance(0.7) ? GO : WAIT); break;
            case 'auto': if (!open.invalidated) api.auto(open.id, 1); break;
            case 'discard': api.discard(open.id); break;
            case 'send': if (host.ctx.chat.at(-1)?.is_user) api.send(open.id); break;
            case 'swipe': if (head > 0 && !host.ctx.chat.at(-1)?.is_user) await host.swipe(`W${step}.`); break;
            case 'regenerate': if (head > 0 && !host.ctx.chat.at(-1)?.is_user) await host.regenerate(`G${step}.`); break;
            case 'deleteMiddle': if (list.length > 3) await dropAt(list[r.int(1, list.length - 2)]); break;
            case 'deleteLast': if (list.length > 2 && !host.ctx.chat.at(-1)?.is_user) await dropAt(head); break;
            case 'reread': if (list.length > 1) { const at = r.pick(list.slice(1)); setText(host, at, withLines(`E${step}.`, r.chance(0.5) ? ['! ia luck1'] : [])); await host.turn.reread(at); } break;
            case 'rereadAnchor': { const first = list[1]; if (first !== undefined) { setText(host, first, withLines('A.', [`! ia lamp${r.int(1, 2)}`])); await host.turn.reread(first); } break; }
            case 'reload': await host.turn.onChatChanged(); break;
            case 'setLamp': await host.sdk.command('ia.set', { key: 'luck', value: r.int(0, 3) }); break;
            default: break;
        }
        await check(`step ${step} (${move})`);
        reached.settles = Math.max(reached.settles, activeSettles(host).length);
        reached.derived += activeSettles(host).filter(item => item.result.mate === 'hum').length;
    }
    reached.takenBack += host.turn.problems().filter(item => item.code === 'INTERACTION_TAKEN_BACK').length;
    reached.replanned += host.turn.problems().filter(item => item.code === 'REPLANNED').length;
    reached.runs += 1;
}

for (const seed of SEEDS) test(`interaction fuzz seed ${seed}: reload equals live, the session follows the line, the bag is the settled changes`, async t => { await run(t, seed); });

test('the interaction fuzz reaches settles, a derived companion, a take-back and a replan', t => {
    if (process.env.QA_IA_SEED || reached.runs < SEEDS.length) return t.skip('only some seeds ran');
    if (process.env.QA_IA_STATS) console.log(JSON.stringify(reached));
    assert.ok(reached.settles > 0 && reached.derived > 0, 'no seed settled a segment with its derived companion');
    assert.ok(reached.takenBack > 0 && reached.replanned > 0, 'no seed took a block back or planned one again');
});
