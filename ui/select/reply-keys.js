// The key of each message's place in a chat for the reply cards' cache: a chained hash of every message up to it (which object it is, its
// stored record, its swipe and its text's length), so a card is worked out again only when something at or before its reply changed.

const ids = new WeakMap();
let next = 0;
const idOf = value => (value && typeof value === 'object' ? (ids.get(value) ?? (ids.set(value, ++next), next)) : 0);

// FNV-1a over one token, continuing from `h` (32 bits).
function fnv(h, token) {
  let out = h >>> 0;
  for (let i = 0; i < token.length; i += 1) { out ^= token.charCodeAt(i); out = Math.imul(out, 16777619) >>> 0; }
  return out;
}

/** `chat` → one key per message: `<index>:<two chained hashes>`; a delete, a swipe, an edit or a Re-read before a message changes its key and every later one. */
export function prefixKeys(chat) {
  let a = 2166136261;
  let b = 5381;
  return (Array.isArray(chat) ? chat : []).map((message, index) => {
    const token = `${idOf(message)}:${idOf(message?.extra?.storySuite)}:${message?.swipe_id ?? 0}:${String(message?.mes ?? '').length}:${message?.is_user ? 1 : 0}`;
    a = fnv(a, token);
    b = fnv(b ^ 0x9e3779b9, `${token}|${index}`);
    return `${index}:${a.toString(36)}.${b.toString(36)}`;
  });
}
