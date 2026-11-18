// Perf PB8 (docs/dev/edit-prose-only.md): a seeded fuzz of edits on twin hosts. Each seed tells the same chat twice, on a
// host with the guarded test module (clock lines, guarded story lines, and system steps that are planned again):
// `skip` is sent the edited message's index (a prose-only edit skips the reconcile), `full` is sent none (the full path,
// as main runs every edit). The steps: sends (with steps planned again after them), prose-only edits and block edits of
// any reply, swipes and swipes back, middle and last deletes, grown and shrunk edited Re-reads, rewinds, reloads and a
// chat change and back. After every step the two heads and their Problems are equal, and the skip host's head equals a
// fresh host that loads its chat (replay == live). Once both hosts have reconciled (a swipe, a delete or a Re-read after
// the edits), what replay reads from every record is equal too: the stamps the skipped edits left stale land as main's.
// QA_EDIT_SEEDS=1-50 runs a longer hunt locally; CI runs the fixed list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { readRecord } from '../../core/persist.js';
import { Q1, guarded } from './helpers/guarded.js';
import { prng, seedCrypto } from '../suite/qa/helpers/seeded.js';
import { seedList } from '../suite/qa/helpers/seed-list.js';

const SEEDS = process.env.QA_EDIT_SEEDS ? seedList(process.env.QA_EDIT_SEEDS) : [1, 2, 3, 4, 5, 6];
const STEPS = Number(process.env.QA_EDIT_STEPS) || 70;

const plain = value => JSON.parse(JSON.stringify(value ?? null));
const clone = value => structuredClone(value);
const MARKER = /<Changes\b|<!--\s*STORY_SUITE_V2\b/i;
const carriers = chat => chat.map((message, index) => (message && !message.is_user && index > 0 ? index : -1)).filter(index => index >= 0);
// What replay reads from each record (the swipe mark follows the text and is stamped by every rebuild alike).
const stored = chat => chat.map(message => {
    const record = readRecord(message);
    return record ? plain({ ops: record.ops, spans: record.spans, receipts: record.receipts, checkpoint: record.checkpoint ?? null, source: record.source }) : null;
});
const problemsOf = host => plain(host.store.problems().map(({ index, block, code, why }) => ({ index, block, code, why })));

// A reply of the fuzz: story text, then a block of clock and guarded story lines.
function replyText(r, step) {
    const lines = [`! tick ${r.int(0, 12) * 10}`];
    if (r.chance(0.4)) lines.push(`! quick th_q${String(step).padStart(6, '0')}`);
    return `Story of step ${step}.\n\nIt goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
}
// The story part of a reply rewritten, its block region kept as it is.
function proseEdit(r, text, step) {
    const at = text.search(MARKER);
    const tail = at < 0 ? '' : text.slice(at);
    return `${r.pick(['Retold', 'Said again', 'Put otherwise'])} at step ${step}.\n\n${tail}`;
}
// The block region changed: another clock line, or a new block after it.
function blockEdit(r, text, step) {
    const changed = text.replace(/! tick \d+/, `! tick ${r.int(0, 12) * 10 + 5}`);
    return changed !== text && r.chance(0.6) ? changed : `${text}\n<Changes>\n! tick ${step % 7}\n</Changes>`;
}
// An edited Re-read: the reply's lines grown (one more clock line) or shrunk (its block emptied of lines), as written text.
function rereadEdit(r, text, step) {
    const story = text.split(MARKER)[0].trimEnd() || 'A reply.';
    return r.chance(0.5)
        ? `${story}\n\n<Changes>\n! tick ${r.int(0, 12) * 10}\n! tick ${r.int(0, 12) * 10}\n! quick th_r${String(step).padStart(6, '0')}\n</Changes>`
        : `${story}\n\n<Changes>\n</Changes>`;
}

// One telling of the seed's chat. `index`: whether MESSAGE_EDITED carries the index. → [{ action, head, problems, records, reconciled }].
async function tell(t, seed, steps, { index }) {
    let restore = seedCrypto(seed);
    const r = prng(seed);
    const host = await createHost({ modules: [guarded()], core: false });
    const { st, ctx } = host;
    let reconciles = 0;
    const reconcile = host.store.reconcile;
    host.store.reconcile = (...args) => { reconciles += 1; return reconcile.apply(host.store, args); };
    const edit = async (at, text) => {
        ctx.chat[at].mes = text;
        if (Array.isArray(ctx.chat[at].swipes)) ctx.chat[at].swipes[ctx.chat[at].swipe_id ?? 0] = text;
        if (index) await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_EDITED, at);
        else await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_EDITED);
    };
    const trace = [];
    let skipped = 0;
    try {
        for (let step = 0; step < steps; step++) {
            // (the host's ids follow the step, so the work only one telling does, a reconcile, cannot shift the other's later ids)
            restore();
            restore = seedCrypto(seed * 1000 + step);
            const replies = carriers(ctx.chat);
            const roll = r.int(0, 19);
            let action = 'send';
            // (a swipe needs a reply as the last message: after a delete the chat may end on the reader's own)
            const lastIsReply = ctx.chat.length > 0 && !ctx.chat.at(-1).is_user && !ctx.chat.at(-1).is_system;
            if (replies.length && roll <= 5) action = 'prose';
            else if (replies.length && roll === 6) action = 'block';
            else if (replies.length && lastIsReply && roll === 7) action = 'swipe';
            else if (replies.length && lastIsReply && roll === 8) action = 'swipeBack';
            else if (replies.length > 2 && roll === 9) action = 'deleteMiddle';
            else if (ctx.chat.length > 3 && roll === 10) action = 'deleteLast';
            else if (replies.length && roll === 11) action = 'reread';
            else if (replies.length && roll === 12) action = 'rewind';
            else if (roll === 13) action = 'reload';
            else if (roll === 14) action = 'chatChange';
            const before = reconciles;
            const entry = { step, action };
            switch (action) {
                case 'send':
                    await host.send(`Message of step ${step}.`, replyText(r, step));
                    if (r.chance(0.7)) await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
                    if (r.chance(0.3)) await host.bus.command('gt.collect', { id: `th_c${String(step).padStart(6, '0')}` }, { cause: 'system' });
                    break;
                case 'prose': case 'block': {
                    const at = r.chance(0.7) ? r.pick(replies) : replies.at(-1);
                    entry.at = at;
                    await edit(at, (action === 'prose' ? proseEdit : blockEdit)(r, ctx.chat[at].mes, step));
                    break;
                }
                case 'swipe': await host.swipe(replyText(r, step)); break;
                case 'swipeBack': {
                    const last = ctx.chat.length - 1;
                    if (ctx.chat[last]?.swipes?.length > 1) await st.swipeTo(last, r.int(0, ctx.chat[last].swipes.length - 1));
                    break;
                }
                case 'deleteMiddle': await st.deleteMessage(r.pick(replies.slice(0, -1))); break;
                case 'deleteLast': await st.deleteMessage(ctx.chat.length - 1); await st.deleteMessage(ctx.chat.length - 1); break;
                case 'reread': {
                    const at = r.pick(replies);
                    entry.at = at;
                    await edit(at, rereadEdit(r, ctx.chat[at].mes, step));
                    entry.reread = (await host.sdk.reread(at))?.ok ?? null;
                    break;
                }
                case 'rewind': {
                    const at = replies.at(-1);
                    const rev = readRecord(ctx.chat[at])?.receipts?.at(-1)?.rev;
                    if (Number.isInteger(rev)) entry.rewind = (await host.sdk.rewind({ index: at, beforeRev: rev }))?.ok ?? null;
                    break;
                }
                case 'reload': await st.loadChat(clone(ctx.chat)); break;
                case 'chatChange': {
                    const id = ctx.chatId, kept = clone(ctx.chat);
                    await st.loadChat([clone(ctx.chat[0])], `other-${step}`);
                    await st.loadChat(kept, id);
                    break;
                }
                default: throw new Error(action);
            }
            await host.store.flush().catch(() => {});
            if (action === 'prose' && index && reconciles === before) skipped += 1;
            trace.push({ ...entry, head: plain(host.store.head()), problems: problemsOf(host), records: stored(ctx.chat), reconciled: reconciles > before, chat: index ? clone(ctx.chat) : null, chatId: ctx.chatId });
        }
    } finally {
        host.close();
        restore();
    }
    return { trace, skipped };
}

for (const seed of SEEDS) {
    test(`edit replay fuzz seed ${seed}: a prose-only edit that skips the reconcile ends as the full path does, and replay equals live`, async t => {
        t.mock.method(console, 'warn', () => {});
        const skip = await tell(t, seed, STEPS, { index: true });
        const full = await tell(t, seed, STEPS, { index: false });
        assert.ok(skip.skipped > 0, `seed ${seed}: some prose edits skipped the reconcile`);
        const oracle = await createHost({ modules: [guarded()], core: false });
        t.after(() => oracle.close());
        let stale = false;      // a skipped edit's stamps not yet stamped again by a reconcile on both sides
        const stats = { skipped: skip.skipped, landed: 0, actions: {}, rereads: skip.trace.filter(entry => entry.reread === true).length, rewinds: skip.trace.filter(entry => entry.rewind === true).length };
        for (let i = 0; i < STEPS; i++) {
            const a = skip.trace[i], b = full.trace[i];
            const label = `seed ${seed} step ${i} ${a.action}${a.at !== undefined ? ` at ${a.at}` : ''}`;
            assert.equal(a.action, b.action, `${label}: the two tellings took the same step`);
            assert.deepEqual(a.head, b.head, `${label}: the head equals the full path's`);
            assert.deepEqual(a.problems, b.problems, `${label}: the Problems equal the full path's`);
            if (a.action === 'prose' && !a.reconciled) stale = true;
            else if (a.reconciled && b.reconciled && stale) { stale = false; stats.landed += 1; }
            stats.actions[a.action] = (stats.actions[a.action] ?? 0) + 1;
            if (!stale) assert.deepEqual(a.records, b.records, `${label}: what replay reads from the records equals the full path's`);
            // Replay == live: a fresh host that loads the skip host's chat has the same head.
            await oracle.st.loadChat(clone(a.chat), `oracle-${seed}-${i}`);
            assert.deepEqual(plain(oracle.store.head()), a.head, `${label}: a reload of the chat equals live`);
        }
        if (process.env.QA_FUZZ_STATS) console.log(JSON.stringify({ seed, ...stats }));
        // The CI seeds' Re-reads and rewinds ran for real, not refused (a local hunt's seed may draw none: its stats show it).
        if (!process.env.QA_EDIT_SEEDS) {
            assert.ok(stats.rereads > 0, `seed ${seed}: some Re-reads were made`);
            assert.ok(stats.rewinds > 0, `seed ${seed}: some rewinds were made`);
        }
    });
}
