import { capturePrompt } from './prompt-capture.mjs';
import { pageSuiteHost } from './suite-host.mjs';
import { discoverQueries, runQueriesAt } from './query-steps.mjs';
import { loadFull, readChanges, rereadAt } from './reread-step.mjs';
import { makeCardText } from './card-text.mjs';
import { applyFlags } from './flags.mjs';
import { sha256, stableStringify } from './state-hash.mjs';

const FIXED_NOW = 1700000000000;

function coverageOf(replies) {
  const exercised = {};
  const skipped = {};
  for (const reply of replies) {
    for (const key of Object.keys(reply.queries?.targeted ?? {})) {
      const name = key.split(' ')[0];
      exercised[name] = (exercised[name] ?? 0) + 1;
    }
    for (const item of reply.queries?.skipped ?? []) {
      const name = item.name.split(' ')[0];
      skipped[name] ??= { count: 0, reason: item.reason };
      skipped[name].count += 1;
    }
  }
  return { exercised, skipped };
}

/**
 * Loads `chat` (`{ header, messages }`) into a fresh suite host and records, per reply: state, receipts/changes,
 * the static prompt and next-reply tail as built for that reply, queries (plain and with real arguments), and a
 * Re-read. Anything that failed is listed in `errors`; a record with errors is never a pass.
 */
export async function recordChat({ suite, chat, flags = null }) {
  const origNow = Date.now;
  Date.now = () => FIXED_NOW;
  let host = null;
  try {
    const makeHost = suite.pageHost ?? pageSuiteHost;
    if (typeof suite.createHost !== 'function') {
      throw new Error('suite.createHost is required');
    }
    host = await makeHost(suite, { seed: 1 });
    const header = chat?.header ?? {};
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    applyFlags(host, flags);
    const cardText = await makeCardText(suite);
    host.ctx.name1 = header.user_name || 'You';
    host.ctx.name2 = header.character_name || 'Narrator';
    await loadFull(host, header, messages);

    const queryNames = discoverQueries(host.registry);
    const replyIndices = (host.ctx.chat ?? [])
      .map((msg, i) => (msg && !msg.is_user && !msg.is_system ? i : -1))
      .filter(i => i >= 0);

    const replies = [];
    const errors = [];
    for (const index of replyIndices) {
      const entry = { index, stateHash: null, changes: null, prompt: null, queries: null, reread: null };
      try {
        entry.stateHash = sha256(stableStringify(host.store.at(index)));
        entry.changes = readChanges(host, index);
        entry.queries = runQueriesAt(host, queryNames, index);
      } catch (err) {
        errors.push({ reply: index, step: 'state', detail: String(err?.message ?? err) });
      }
      if (cardText) {
        try {
          entry.card = cardText(host, index);
        } catch (err) {
          errors.push({ reply: index, step: 'card', detail: String(err?.message ?? err) });
        }
      }
      replies.push(entry);
    }

    // The prompt the host builds for the reply after each one. Later messages are hidden (is_system, as a restore hides them), never
    // removed: a shorter chat no longer matches NPC State Delta's saved records and the host holds the reply back. The story state is the head's.
    for (const entry of replies) {
      try {
        await loadFull(host, header, messages.map((message, i) => (i > entry.index ? { ...message, is_system: true } : message)));
        entry.prompt = await capturePrompt(host);
        if (entry.prompt.error) errors.push({ reply: entry.index, step: 'prompt', detail: entry.prompt.error });
      } catch (err) {
        errors.push({ reply: entry.index, step: 'prompt', detail: String(err?.message ?? err) });
      }
    }

    for (const entry of replies) {
      entry.reread = await rereadAt(host, header, messages, entry.index);
      if (!entry.reread.ok) {
        errors.push({ reply: entry.index, step: 'reread', detail: `${entry.reread.code}${entry.reread.error ? `: ${entry.reread.error}` : ''}` });
      }
    }
    await loadFull(host, header, messages);

    return {
      messageCount: host.ctx.chat.length,
      replyCount: replies.length,
      queryNames,
      queryCoverage: coverageOf(replies),
      errors,
      replies,
      ...(flags && Object.keys(flags).length ? { flags } : {}),
    };
  } finally {
    try {
      host?.close?.();
    } finally {
      Date.now = origNow;
    }
  }
}
