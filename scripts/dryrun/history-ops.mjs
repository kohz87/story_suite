// The history-operation sequence for one chat, seeded from its id: swipe the last reply, delete a middle reply, rewind
// to an earlier reply, reload. Story Block's fuzz PRNG and reply generator drive it; after each step it records the head
// hash, the queries and a Re-read, the same fields the per-reply recording holds.
import { createHash } from 'node:crypto';
import { pageSuiteHost } from './suite-host.mjs';
import { discoverQueries, runQueriesAt } from './query-steps.mjs';
import { loadFull, rereadAt } from './reread-step.mjs';
import { sha256, stableStringify } from './state-hash.mjs';

const FIXED_NOW = 1700000000000;
const OPS = ['swipe', 'deleteMiddle', 'rewind', 'reload'];

const seedOf = chatId => createHash('sha256').update(String(chatId || 'chat')).digest().readUInt32BE(0) || 1;
const repliesOf = chat => chat.map((m, i) => (m && !m.is_user && !m.is_system ? i : -1)).filter(i => i >= 0);

async function snapshot(host, queryNames, op, target) {
  const replies = repliesOf(host.ctx.chat);
  const at = replies.length ? replies.at(-1) : -1;
  const header = { chat_metadata: structuredClone(host.ctx.chatMetadata ?? {}) };
  const saved = structuredClone(host.ctx.chat);
  const entry = { op, target, messageCount: saved.length, replyCount: replies.length, headHash: sha256(stableStringify(host.store.head())), queries: null, reread: null };
  if (at >= 0) {
    entry.queries = runQueriesAt(host, queryNames, at);
    entry.reread = await rereadAt(host, header, saved, at);
    await loadFull(host, header, saved);
  }
  return entry;
}

async function applyOp(host, op, r, replyText, step) {
  const chat = host.ctx.chat;
  const replies = repliesOf(chat);
  if (op === 'swipe') {
    if (chat.length < 2 || !replies.includes(chat.length - 1)) return { skipped: 'last message is not a reply' };
    await host.swipe(replyText(r, step));
    return { target: chat.length - 1 };
  }
  if (op === 'deleteMiddle') {
    const middle = replies.filter(i => i > 0 && i < chat.length - 1);
    if (!middle.length) return { skipped: 'no middle reply' };
    const target = r.pick(middle);
    await host.st.deleteMessage(target);
    return { target };
  }
  if (op === 'rewind') {
    const earlier = replies.filter(i => i < chat.length - 1);
    if (!earlier.length) return { skipped: 'no earlier reply' };
    const target = r.pick(earlier);
    while (host.ctx.chat.length - 1 > target) await host.st.deleteMessage(host.ctx.chat.length - 1);
    return { target };
  }
  await loadFull(host, { chat_metadata: host.ctx.chatMetadata }, host.ctx.chat);
  return { target: null };
}

/**
 * Runs the sequence on `chat` (`{ header, messages }`) in a fresh suite host. Same `chatId` gives the same operations.
 * Returns `{ chatId, seed, ops }`: one entry per operation with its target, head hash, queries and Re-read, or a skip reason.
 */
export async function runHistoryOps({ suite, chat, chatId }) {
  const origNow = Date.now;
  Date.now = () => FIXED_NOW;
  let host = null;
  try {
    const [{ prng }, { replyText }] = await Promise.all([suite.at('tests/v2/qa/helpers/seeded.js'), suite.at('tests/v2/qa/helpers/state-fuzz-gen.js')]);
    const seed = seedOf(chatId);
    const r = prng(seed);
    host = await (suite.pageHost ?? pageSuiteHost)(suite, { seed });
    const header = chat?.header ?? {};
    host.ctx.name1 = header.user_name || 'You';
    host.ctx.name2 = header.character_name || 'Narrator';
    await loadFull(host, header, Array.isArray(chat?.messages) ? chat.messages : []);
    const queryNames = discoverQueries(host.registry);
    const ops = [];
    for (const [n, op] of OPS.entries()) {
      try {
        const done = await applyOp(host, op, r, replyText, n + 1);
        ops.push(done.skipped ? { op, skipped: done.skipped } : await snapshot(host, queryNames, op, done.target));
      } catch (err) {
        ops.push({ op, error: String(err?.message ?? err) });
      }
    }
    return { chatId: String(chatId), seed, ops };
  } finally {
    try {
      host?.close?.();
    } finally {
      Date.now = origNow;
    }
  }
}
