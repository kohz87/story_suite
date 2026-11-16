// QA fuzz helper: the seeded "edit then Re-read" fuzz (state-fuzz-reread.test.js). Each run tells a chat on
// the real host (testkit createHost: real store, command bus, turn, Story Block's core module and the probe
// module) with sends, swipes, Regenerates and deletes of the last pair, and now and then picks an earlier
// reply, rewrites its text to a variant with more or different lines (reread-fuzz-gen.js) and presses the
// real Re-read (sdk.reread). An unedited Re-read is the control. After every step the state at every reply
// equals the replay oracle's rebuild (oracle.js checkInvariants). After every Re-read no stored add lands on a
// rev-keyed entry or a guarded claim already there (key-clash.js: a later reply's key run into by the edited
// reply's, which the replay oracle cannot see), and the state at every reply and the readers equal the story told
// the edited way: a brand-new host sent the chat's texts as they read now (retell.js). A difference there that
// goes once every reply is Re-read is a later reply that kept what it recorded (by design, counted); one the
// Re-reads cannot settle (refused, CONFLICT) or a stack chosen by ID order is counted too; anything else fails.
// No UI commands, cues, board fights, middle deletes or Continues: those leave state a fresh telling of the
// texts cannot give, so the told-again check would not hold for them (state-fuzz-run.js covers them).
// A failing seed replays exactly: the host's crypto IDs and seeds follow the run's seed.
// Not a test file (the test glob does not match helpers/).
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { prng, seedCrypto } from './seeded.js';
import { probeModule } from './probe-module.js';
import { carriers, checkInvariants } from './oracle.js';
import { replyText } from './state-fuzz-gen.js';
import { editedText } from './reread-fuzz-gen.js';
import { compareTold, rereadAll } from './retell.js';
import { keyClashes } from './key-clash.js';

/** The readers compared with the story told again (Story Block's core queries and the probe's). */
export const READERS = ['inventory.items', 'inventory.wallet', 'inventory.loot', 'inventory.counts', 'inventory.equipment',
    'scene.place', 'scene.present', 'scene.weather', 'scene.you', 'mounts.list', 'probe.n'];

const plain = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** The fuzz's host: the core module, the probe module and gear on (the RPG is off: its rolls would differ in a new telling). */
export const defaultHost = () => createHost({ modules: [probeModule()], settings: { features: { 'story-block.gear': true } } });

/**
 * One run of `steps` steps for `seed`. Options: `makeHost` (a host maker for both the live chat and the told
 * one, to fuzz with other modules), `extraLines(r)` (a list of that host's own change lines: the edits draw from it,
 * and each reply gets up to two of them in its block; without it the replies are state-fuzz-gen.js replyText's),
 * `readers` (query names), `told` (false: the key-clash check alone after a Re-read, for a host whose modules the
 * told-again compare is not checked against). Returns { counts, edits: { kinds, refused }, later, laterPaths, legacyClaims, stackChoice, conflict } for the stats.
 */
export async function fuzzReread(t, seed, steps, { makeHost = defaultHost, extraLines = null, readers = READERS, told = true } = {}) {
    const restore = seedCrypto(seed);
    t.after(restore);
    t.mock.method(console, 'warn', () => {});
    const r = prng(seed);
    const host = await makeHost();
    t.after(() => host.close());
    const { st, ctx } = host;
    const trace = [];
    const counts = {};
    const edits = { kinds: {}, refused: 0 };
    // What was counted, not failed (toldCheck): differences settled by Re-reading every reply (by first path), legacy
    // claims held twice (by path), stacks chosen by ID order, and differences the Re-reads could not settle (CONFLICT).
    const stats = { later: 0, laterPaths: {}, legacyClaims: {}, stackChoice: 0, conflict: 0 };

    // An earlier reply most of the time (the case where later replies hold keys), the last one now and then.
    const pickReply = () => {
        const replies = carriers(ctx.chat).filter(index => index > 0);
        if (!replies.length) return -1;
        return replies.length > 1 && r.chance(0.8) ? r.pick(replies.slice(0, -1)) : replies.at(-1);
    };

    async function reread(at, stepTrace) {
        const head = plain(host.store.head());
        const done = await host.sdk.reread(at);
        stepTrace.reread = { ok: done?.ok, code: done?.code };
        return { done, head };
    }

    const where = diff => `${typeof diff.at === 'number' ? `reply ${diff.at}` : diff.at} ${diff.path}\nlive: ${JSON.stringify(diff.live)}\ntold: ${JSON.stringify(diff.told)}`;
    const traced = () => `steps:\n${trace.map(entry => JSON.stringify(entry)).join('\n')}`;

    // After a Re-read, first: no stored add lands on a key in use (key-clash.js; checked before the replay oracle,
    // which a clash can also trip, so the failure names it). A legacy block's claim held twice is counted, not
    // failed: replay takes it as written (REPLAY.md).
    function clashCheck(label) {
        const clashes = keyClashes(ctx.chat);
        const failing = clashes.filter(clash => clash.kind === 'rev' || clash.guarded);
        if (failing.length) assert.fail(`${label}: a stored add lands on a key in use: ${JSON.stringify(failing)}\n${traced()}`);
        for (const clash of clashes) stats.legacyClaims[clash.path] = (stats.legacyClaims[clash.path] ?? 0) + 1;
    }

    // Then: the chat equals the story told the edited way, or does once every reply is Re-read (a later reply that
    // kept what it recorded, see rereadAll).
    async function toldCheck(label) {
        if (!told) return;
        const diff = await compareTold(host, makeHost, readers);
        if (!diff) return;
        const { copy, refused } = await rereadAll(ctx.chat, makeHost);
        try {
            if (refused.length) { stats.conflict += 1; return; }
            const still = await compareTold(copy, makeHost, readers);
            // (one that goes when the bag is compared by item totals is a stack chosen by ID order, retell.js looseState)
            const loose = still && await compareTold(copy, makeHost, readers, { loose: true });
            if (still && !loose) { stats.stackChoice += 1; return; }
            if (still) assert.fail(`${label}: the chat differs from the story told the edited way, even with every reply Re-read, first at ${where(still)}\n(by item totals: ${where(loose)})\n(before the Re-reads: ${where(diff)})\n${traced()}`);
        } finally {
            copy.close();
        }
        stats.later += 1;
        stats.laterPaths[diff.path] = (stats.laterPaths[diff.path] ?? 0) + 1;
    }

    // A reply of the fuzz, with up to two of the host's own lines in its block (none, and no draw, without extraLines).
    const reply = step => {
        const text = replyText(r, step);
        if (!extraLines) return text;
        const own = Array.from({ length: r.int(0, 2) }, () => r.pick(extraLines(r)));
        if (!own.length) return text;
        return text.includes('</Changes>') ? text.replace(/<\/Changes>(?![\s\S]*<\/Changes>)/, `${own.join('\n')}\n</Changes>`) : `${text}\n<Changes>\n${own.join('\n')}\n</Changes>`;
    };

    for (let step = 0; step < steps; step++) {
        const roll = r.int(0, 9);
        const hasReply = ctx.chat.length > 1;
        let action = 'send';
        if (roll === 4 && hasReply) action = 'swipe';
        else if (roll === 5 && hasReply) action = 'regenerate';
        else if (roll === 6 && ctx.chat.length > 3) action = 'deleteLast';
        else if ((roll === 7 || roll === 8) && hasReply) action = 'editReread';
        else if (roll === 9 && hasReply) action = 'reread';
        counts[action] = (counts[action] ?? 0) + 1;
        const label = `seed ${seed} step ${step} ${action}`;
        const stepTrace = { step, action };
        trace.push(stepTrace);

        switch (action) {
            case 'send': stepTrace.reply = reply(step); await host.send(`Message of step ${step}.`, stepTrace.reply); break;
            case 'swipe': stepTrace.reply = reply(step); await host.swipe(stepTrace.reply); break;
            case 'regenerate': stepTrace.reply = reply(step); await host.regenerate(stepTrace.reply); break;
            case 'deleteLast':
                // The last reply and its user message, so the chat stays a user message and a reply in turn (retell.js).
                await st.deleteMessage(ctx.chat.length - 1);
                await st.deleteMessage(ctx.chat.length - 1);
                break;
            case 'reread': {
                const at = pickReply();
                stepTrace.index = at;
                const { done } = await reread(at, stepTrace);
                clashCheck(label);
                checkInvariants(host, label, { trace });
                if (done?.ok) await toldCheck(label);
                break;
            }
            case 'editReread': {
                const at = pickReply();
                const old = ctx.chat[at].mes;
                const edit = editedText(r, old, { extraLines });
                Object.assign(stepTrace, { index: at, kind: edit.kind, text: edit.text });
                edits.kinds[edit.kind] = (edits.kinds[edit.kind] ?? 0) + 1;
                await st.editMessage(at, edit.text);
                const { done, head } = await reread(at, stepTrace);
                if (!done?.ok) {
                    // A refused Re-read changes nothing; the old text goes back so the chat can still be told again.
                    edits.refused += 1;
                    assert.deepEqual(plain(host.store.head()), head, `${label}: a refused Re-read (${done?.code}) leaves the state as it was`);
                    await st.editMessage(at, old);
                }
                clashCheck(label);
                checkInvariants(host, label, { trace });
                if (done?.ok) await toldCheck(label);
                break;
            }
            default: throw new Error(action);
        }
        if (action !== 'reread' && action !== 'editReread') checkInvariants(host, label, { trace });
    }
    // The end of the run is told again too, whatever the last step was.
    clashCheck(`seed ${seed} end`);
    await toldCheck(`seed ${seed} end`);
    return { counts, edits, ...stats };
}
