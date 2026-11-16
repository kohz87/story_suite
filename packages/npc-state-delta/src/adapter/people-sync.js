// NPC State's side of the one timeline: the Story Block store holds the people, NPC State's memory is a cache of it.
//   hydrate(): replaces the cache's people with the store's slice at the head, and remembers which reply ({ sid, swipeKey }) the cache now stands on.
//   commit(state): after a change of NPC State's own, sends one `people.write` for that remembered reply. The store refuses it (STALE) when the head
//   moved, and the cache then re-hydrates: the work belonged to a reply that is gone (nothing is owed, healed or re-sent).
//   sync(): hydrates when the store's people are not the ones the cache last read or wrote (a swipe, delete, rewind, Re-read or reload changed them); when only the head's reply
//   changed (a new reply) the cache keeps its uncommitted work and stands on the new reply (called on the host's turn and head events and on a chat load).
// Both go through one queue, so a hydrate never runs inside a commit. A hydrate never sends anything.
// Three more rules. A head whose reply replaced one (a delete or swipe, then a new reply at the same place) tells the runtime to read that reply again (`rescan`), whatever the people
// are. A change made before the first hydrate is owed: the first hydrate carries it over the store's people (`carry`) and commits it. A change that finds the head already on a
// newer reply than the cache stands on (the store's people unchanged) belongs to that reply: the cache stands on it first.
// The scan marker lives in the store (people.scan = { lastSid, swipeKey, since }, written with each commit, never part of the people hash): a hydrate, and a head
// that moved back or to the same place (a swipe, swipe back, delete, regenerate), set NPC State's marker from it (`mark`), so a swipe back to a read swipe is not
// read again and a reply that replaced one is. An unknown sid (its reply was deleted) means "read the latest"; with no marker stored the old rules hold (rescan, clamp).
// The people hash compared is `people.hash { dossiers: true }`: the meters (`bonds`, written by the reply's own change lines) and the marker are not the cache's.

/**
 * { sdk() → host sdk | null, view(state) → people view | null, restore(view) → people keys | null, hash(value) → string,
 *   readState() → the cache's state | null, install(keys) → boolean (replaces the cache's people), ready() → boolean, warn(text),
 *   chatKey() → the open chat's key, rescan() (the head's reply replaced one: read it again), carry(keys, state) → keys (the cache's work the store lacks, added),
 *   mark(index | null, since?) (sets the scan marker: the last reply read, by its index in the history) }
 * → { commit(state) → Promise<{ sent, skipped?, stale?, owed? }>, hydrate() → Promise<{ hydrated, source? }>, sync() → Promise<{ hydrated }>, source() → the cache's reply }.
 */
export function createPeopleSync({ sdk, view, restore, hash, readState = () => null, install = () => false, ready = () => true, warn = () => {}, chatKey = () => '', rescan = () => {}, carry = keys => keys, mark = () => false }) {
    let cache = null;      // { sid, swipeKey } the cache stands on, or null (no reply yet / not hydrated)
    let at = null;         // the reply's place in the story (its index in the host's history) the cache stands on
    let hydrated = false;
    let chat = null;       // the chat the cache and `known` belong to
    let owed = false;      // a change was made before the first hydrate: the hydrate carries it
    let known = null;      // the hash of the store's people slice as this cache last read or wrote it: a different one means the store moved underneath (a middle delete keeps the head's reply)
    let chain = Promise.resolve();
    const queue = task => { const run = chain.then(task, task); chain = run.catch(() => {}); return run; };
    const host = () => { const api = sdk(); return api && typeof api.query === 'function' && typeof api.command === 'function' ? api : null; };
    const stored = api => { try { return api.query('people.hash', { dossiers: true }) ?? null; } catch { return null; } };
    const headOf = async api => {
        try { const head = await api.timeline?.head?.({}); return head?.ok === true ? { source: head.source ?? null } : null; } catch { return null; }
    };
    // The store's people slice: ABSENT before the first people.write (the domain is deferred) means no people, never an error; null only when the store cannot be read at all.
    const EMPTY = { v: 1, order: [], npcs: {} };
    const sliceOf = api => { try { const state = api.view?.()?.state; return state && typeof state === 'object' ? (state.domains?.people ?? EMPTY) : null; } catch { return null; } };
    // The host's message history ([{ sid, swipeKey }], one per message), or null.
    const historyOf = async api => { try { const out = await api.timeline?.history?.({}); return out?.ok === true && Array.isArray(out.messages) ? out.messages : null; } catch { return null; } };
    // A reply's place in the story: its index in the host's message history (`source.ordinal` is the block's place inside its reply, not the reply's).
    const placeOf = async (api, source) => {
        if (!source) return null;
        const messages = await historyOf(api);
        const at = messages ? messages.findIndex(message => message?.sid === source.sid) : -1;
        return at >= 0 ? at : null;
    };
    const scanOf = api => { const scan = sliceOf(api)?.scan; return scan && typeof scan === 'object' && typeof scan.lastSid === 'string' ? scan : null; };
    // The store's marker as NPC State's index at a head whose place is `place`: the reply it names when that reply is still there on the same swipe; the one before
    // when it is there on another swipe (that swipe was not read); "read the latest" when its sid is gone. Never past the head.
    const markFrom = async (api, scan, place) => {
        const messages = await historyOf(api);
        if (!messages) return false;
        const head = Number.isInteger(place) ? place : messages.length - 1;
        const at = messages.findIndex(message => message?.sid === scan.lastSid);
        let index = at < 0 ? head - 1 : (messages[at].swipeKey === scan.swipeKey ? at : at - 1);
        index = Math.min(index, head);
        try { return mark(index >= 0 ? index : null, scan.since) !== false; } catch { return false; }
    };
    // The cache's marker as the store keeps it, or undefined when it names no reply of the history.
    const scanFor = async (api, state) => {
        const index = state?.lastScannedMessageId;
        if (!Number.isInteger(index) || index < 0) return undefined;
        const messages = await historyOf(api);
        const message = messages?.[index];
        if (!message || typeof message.sid !== 'string' || !message.sid) return undefined;
        const since = Number.isInteger(state.assistantSinceScan) && state.assistantSinceScan >= 0 ? state.assistantSinceScan : 0;
        return { lastSid: message.sid, swipeKey: String(message.swipeKey ?? ''), since };
    };
    // The head moved back or to the same place: the marker comes from the store; with none stored, a replaced reply is read again (rescan) and a marker past the head is held to it.
    const remark = async (api, place, state) => {
        const scan = scanOf(api);
        if (scan) return markFrom(api, scan, place);
        if (place === at) { rescan(); return true; }
        const index = state?.lastScannedMessageId;
        if (Number.isInteger(index) && Number.isInteger(place) && index > place) { try { mark(place, undefined); } catch { /* the next scan reads it */ } }
        return true;
    };
    const keyNow = () => { try { return String(chatKey() ?? ''); } catch { return ''; } };
    // Another chat is open than the one the cache was read for: the cache stands on nothing, whatever the hashes say.
    const sameChat = () => {
        if (chat !== null && keyNow() !== chat) { cache = null; at = null; hydrated = false; known = null; owed = false; chat = null; }
    };
    // The head's reply took the very place of one the cache stood on (a swipe, or a delete then a new reply before the cache looked): a scan marker that says it was read is wrong.
    // A newer reply, or an older head after a delete, is not a replacement (the hydrate clamp holds the marker there).
    const replaced = async (api, source) => Boolean(cache && source && (source.sid !== cache.sid || source.swipeKey !== cache.swipeKey) && at !== null && await placeOf(api, source) === at);

    async function hydrateNow() {
        sameChat();
        const api = host();
        if (!api || !ready()) return { hydrated: false };
        const head = await headOf(api);
        if (!head) return { hydrated: false };
        const slice = sliceOf(api);
        const sliceHash = stored(api);   // read with the slice, before any await: a store move in the awaits below is then seen by the next look
        let keys = slice === null ? null : restore(slice);
        if (!keys) {
            if (slice !== null) warn('NPC State could not read the people from the store.');
            return { hydrated: false };
        }
        const swapped = await replaced(api, head.source);
        const pending = owed ? readState() : null;
        if (pending) keys = carry(keys, pending) ?? keys;
        if (!install(keys)) return { hydrated: false };
        const scan = scanOf(api);
        if (scan) await markFrom(api, scan, await placeOf(api, head.source));
        else if (swapped) rescan();
        cache = head.source ? { sid: head.source.sid, swipeKey: head.source.swipeKey } : null;
        at = await placeOf(api, head.source);
        chat = keyNow();
        known = sliceHash;
        hydrated = true;
        if (pending && owed) { owed = false; if (cache) await commitNow(readState()); }
        return { hydrated: true, source: cache };
    }

    async function syncNow() {
        sameChat();
        const api = host();
        if (!api || !ready()) return { hydrated: false };
        const head = await headOf(api);
        if (!head) return { hydrated: false };
        const here = head.source ? { sid: head.source.sid, swipeKey: head.source.swipeKey } : null;
        if (hydrated && stored(api) === known) {
            // The store's people are the ones the cache read or wrote: nothing to replace, and replacing would throw away what NPC State has made for this reply and
            // not committed yet (a scan, a cast dossier). Only the reply the cache stands on moves, so the next commit goes to the new head.
            const place = await placeOf(api, head.source);
            const moved = cache && here && (here.sid !== cache.sid || here.swipeKey !== cache.swipeKey);
            // Back or to the same place (a swipe, swipe back, last delete, regenerate) or the same reply at another place (a middle delete before it): the marker is the store's.
            if (place !== null && at !== null && (place < at || (moved && place === at))) await remark(api, place, readState());
            cache = here;
            at = place;
            return { hydrated: false };
        }
        return hydrateNow();
    }

    async function commitNow(state) {
        sameChat();
        const api = host();
        if (!api || !state) return { sent: false };
        // Before the first hydrate the cache is nobody's: a change made now is owed, and the first hydrate adds it to what the store holds.
        if (!hydrated) { owed = true; warn('NPC State changed people before the story was ready; they are kept and stored as soon as it is.'); return { sent: false, owed: true }; }
        if (!cache || cache.sid === undefined) return { sent: false };
        // The store moved underneath the cache (a middle delete keeps the head's reply, so the reply alone does not tell): the change belonged to a story that is gone.
        if (stored(api) !== known) { hydrated = false; await hydrateNow(); return { sent: false, stale: true }; }
        // The host's head is already on a newer reply and nothing else changed in the store: the change was made for that reply (NPC State saw the reply before the host's turn event).
        const head = await headOf(api);
        if (head?.source && (head.source.sid !== cache.sid || head.source.swipeKey !== cache.swipeKey) && stored(api) === known) {
            // Same place (a swipe or swipe back caught here first): the marker comes from the store, as in sync.
            const place = await placeOf(api, head.source);
            if (place !== null && at !== null && place <= at) await remark(api, place, state);
            cache = { sid: head.source.sid, swipeKey: head.source.swipeKey };
            at = place;
        }
        const built = view(state, { warn });
        if (!built) return { sent: false };
        // The marker is the runtime's as it is now (a remark above, or a snapshot handed in by a death, must not store an older one).
        const scan = await scanFor(api, readState() ?? state);
        const scanSame = scan === undefined || JSON.stringify(scanOf(api)) === JSON.stringify(scan);
        if (stored(api) === hash(built) && scanSame) { known = stored(api); return { sent: false, skipped: true }; }
        // No people slice in the store yet (the domain is deferred) and nobody to store: nothing is written, so a chat that never has people keeps its bytes.
        if (stored(api) === null && !built.order.length && !built.candidates.length && !built.dismissed.length && !built.userDismissedGroups.length) { known = null; return { sent: false, skipped: true }; }
        let out;
        try { out = await api.command('people.write', { v: 1, source: { sid: cache.sid, swipeKey: cache.swipeKey }, view: built, ...(scan && !scanSame ? { scan } : {}) }, { background: true }); } catch (error) { out = { ok: false, code: 'FAILED', message: String(error?.message ?? error) }; }
        if (out?.ok === false) {
            if (out.code === 'STALE' || out.code === 'RESTORE_PENDING') {
                hydrated = false;   // the cache stands on a reply that is gone: the next head look (here, or on the host's next event) hydrates again
                await hydrateNow();
                return { sent: false, stale: true };
            }
            warn(`NPC State could not store the people (${out.code}): ${out.message ?? ''}`);
            return { sent: false };
        }
        known = stored(api);
        return { sent: true };
    }

    return {
        commit: state => queue(() => commitNow(state ?? readState())),
        hydrate: () => queue(hydrateNow),
        sync: () => queue(syncNow),
        source: () => cache,
        /** The chat closed or changed: the cache stands on nothing until the next hydrate. */
        forget: () => { cache = null; at = null; hydrated = false; known = null; owed = false; chat = null; },
    };
}
