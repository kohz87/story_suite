import { createHash } from 'node:crypto';
import { capturePrompt } from './prompt-capture.mjs';
import { pageSuiteHost } from './suite-host.mjs';
import { planTargetedQueries } from './query-args.mjs';

const QUERY_PREFIXES = ['scene.', 'inventory.', 'director.', 'npc.'];
const FIXED_NOW = 1700000000000;

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === 'function') {
    return stableStringify(value.toJSON());
  }
  if (Array.isArray(value)) {
    const items = value.map(item =>
      item === undefined || typeof item === 'function' || typeof item === 'symbol'
        ? 'null'
        : stableStringify(item),
    );
    return `[${items.join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter(k => value[k] !== undefined && typeof value[k] !== 'function' && typeof value[k] !== 'symbol')
    .sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(',')}}`;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function discoverQueries(registry) {
  const names = new Set();
  for (const mod of registry?.modules?.() ?? []) {
    for (const name of Object.keys(mod?.queries ?? {})) {
      if (QUERY_PREFIXES.some(prefix => name.startsWith(prefix))) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function readChanges(host, index) {
  if (typeof host.changesCardText === 'function') {
    return { source: 'changesCard', value: host.changesCardText(index) };
  }
  const receipts = host.ctx?.chat?.[index]?.extra?.storySuite?.receipts ?? null;
  return { source: 'receipts', value: receipts ? structuredClone(receipts) : null };
}

function toJson(value) {
  return value === undefined ? null : JSON.parse(stableStringify(value));
}

function runQueriesAt(host, queryNames, index) {
  const values = {};
  const skipped = [];
  for (const name of queryNames) {
    try {
      values[name] = toJson(host.sdk.query(name, { asOf: index }));
    } catch (err) {
      skipped.push({ name, reason: String(err?.message ?? err) });
    }
  }
  const plan = planTargetedQueries(queryNames, values, host.store.at(index));
  const targeted = {};
  for (const { name, args } of plan.calls) {
    const label = `${name} ${JSON.stringify(args)}`;
    try {
      targeted[label] = toJson(host.sdk.query(name, { ...args, asOf: index }));
    } catch (err) {
      skipped.push({ name: label, reason: String(err?.message ?? err) });
    }
  }
  return { values, targeted, skipped: [...skipped, ...plan.skipped] };
}

async function loadFull(host, header, messages) {
  host.ctx.chatMetadata = structuredClone(header.chat_metadata ?? {});
  await host.st.loadChat(structuredClone(messages));
}

// Re-read on a fresh load of the chat, so one reply's failure cannot leave the next one pending.
async function rereadAt(host, header, messages, index) {
  try {
    await loadFull(host, header, messages);
    const res = await host.turn.reread(index);
    const reread = {
      ok: res?.ok === true,
      code: res?.code ?? null,
      result: toJson(res),
      headHashAfter: sha256(stableStringify(host.store.head())),
      changesAfter: readChanges(host, index),
      replyHashAfter: sha256(String(host.ctx.chat?.[index]?.mes ?? '')),
    };
    return reread;
  } catch (err) {
    return { ok: false, code: 'THREW', result: null, headHashAfter: null, changesAfter: null, replyHashAfter: null, error: String(err?.message ?? err) };
  }
}

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
export async function recordChat({ suite, chat }) {
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
    };
  } finally {
    try {
      host?.close?.();
    } finally {
      Date.now = origNow;
    }
  }
}
