// Loading a chat into the host and Re-reading one reply on a fresh load, shared by both recordings.
import { sha256, stableStringify, toJson } from './state-hash.mjs';

export function readChanges(host, index) {
  if (typeof host.changesCardText === 'function') {
    return { source: 'changesCard', value: host.changesCardText(index) };
  }
  const receipts = host.ctx?.chat?.[index]?.extra?.storySuite?.receipts ?? null;
  return { source: 'receipts', value: receipts ? structuredClone(receipts) : null };
}

export async function loadFull(host, header, messages) {
  host.ctx.chatMetadata = structuredClone(header.chat_metadata ?? {});
  await host.st.loadChat(structuredClone(messages));
}

// Re-read on a fresh load of the chat, so one reply's failure cannot leave the next one pending.
export async function rereadAt(host, header, messages, index) {
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
