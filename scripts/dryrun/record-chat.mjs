import { createHash } from 'node:crypto';

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

function readStaticPrompts(host) {
  const prompts = host.st?.prompts?.() ?? {};
  const out = {};
  for (const key of Object.keys(prompts).sort()) {
    if (key.startsWith('story_suite_static')) {
      out[key] = prompts[key]?.value ?? '';
    }
  }
  return out;
}

function readTailPrompt(host) {
  if (typeof host.turn?.preview !== 'function') {
    return { skipped: 'turn.preview unavailable', parts: null };
  }
  try {
    const parts = host.turn.preview();
    const tail = (Array.isArray(parts) ? parts : [])
      .filter(part => part?.place === 'tail')
      .map(part => ({ module: part.module ?? null, label: part.label ?? null, text: part.text ?? '' }));
    return { skipped: null, parts: tail };
  } catch (err) {
    return { skipped: String(err?.message ?? err), parts: null };
  }
}

function readChanges(host, index) {
  if (typeof host.changesCardText === 'function') {
    return { source: 'changesCard', value: host.changesCardText(index) };
  }
  const receipts = host.ctx?.chat?.[index]?.extra?.storySuite?.receipts ?? null;
  return { source: 'receipts', value: receipts ? structuredClone(receipts) : null };
}

function runQueriesAt(host, queryNames, index) {
  const values = {};
  const skipped = [];
  for (const name of queryNames) {
    try {
      const result = host.sdk.query(name, { asOf: index });
      values[name] = result === undefined ? null : JSON.parse(stableStringify(result));
    } catch (err) {
      skipped.push({ name, reason: String(err?.message ?? err) });
    }
  }
  return { values, skipped };
}

/**
 * Loads `chat` (`{ header, messages }`) into a fresh suite host, records per-reply state,
 * receipts/changes, prompts, and queries, then runs Re-read on every assistant reply.
 */
export async function recordChat({ suite, chat }) {
  const origNow = Date.now;
  Date.now = () => FIXED_NOW;
  let host = null;
  try {
    const makeHost = suite.suiteHost;
    if (typeof makeHost !== 'function') {
      throw new Error('suite.suiteHost is required');
    }
    host = await makeHost(suite, { seed: 1 });
    const header = chat?.header ?? {};
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    host.ctx.name1 = header.user_name || 'You';
    host.ctx.name2 = header.character_name || 'Narrator';
    if (header.chat_metadata) {
      host.ctx.chatMetadata = structuredClone(header.chat_metadata);
    }
    await host.st.loadChat(structuredClone(messages));

    const queryNames = discoverQueries(host.registry);
    const staticPrompts = readStaticPrompts(host);
    const tailPrompt = readTailPrompt(host);
    const replyIndices = (host.ctx.chat ?? [])
      .map((msg, i) => (msg && !msg.is_user && !msg.is_system ? i : -1))
      .filter(i => i >= 0);

    const replies = [];
    for (const index of replyIndices) {
      try {
        const state = host.store.at(index);
        const stateHash = sha256(stableStringify(state));
        const changes = readChanges(host, index);
        const queries = runQueriesAt(host, queryNames, index);
        replies.push({ index, stateHash, changes, queries, reread: null, error: null });
      } catch (err) {
        replies.push({ index, stateHash: null, changes: null, queries: null, reread: null, error: String(err?.message ?? err) });
      }
    }

    for (const entry of replies) {
      try {
        const res = await host.turn.reread(entry.index);
        const headHashAfter = sha256(stableStringify(host.store.head()));
        entry.reread = {
          ok: res?.ok ?? null,
          code: res?.code ?? null,
          headHashAfter,
        };
      } catch (err) {
        entry.reread = {
          ok: false,
          code: 'THREW',
          headHashAfter: null,
          error: String(err?.message ?? err),
        };
      }
    }

    return {
      messageCount: host.ctx.chat.length,
      replyCount: replies.length,
      staticPrompts,
      tailPrompt,
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
