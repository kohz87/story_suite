// Sends the state NSD just published to the host's `people` read-model (one `people.mirror` command per publication) and heals the head
// after the story moves. Off unless the host answers `people.mirrorOn` true; a host without the query counts as off. Never reads the live state
// for a publication: it sends the published copy. A stale or failed send is owed and goes out with the next publication.

const HEAL_POLL_MS = 250;
const HEAL_POLLS = 40;

/**
 * { sdk() → host sdk | null, view(state) → people view | null, hash(value) → string, readState() → live state,
 *   warn(text), idle(ms) → Promise<boolean>, settled() → Promise<boolean> (the head barrier is down), catchUp() → boolean (a replay is running),
 *   schedule(fn, ms) }
 * → { onPublished({ state, source }), heal(), start(), stats() }.  `start()` listens to the host's `head` event and returns the stop function.
 */
export function createPeopleMirror({ sdk, view, hash, readState, warn = () => {}, idle = async () => true, settled = async () => true, catchUp = () => false, schedule = (fn, ms) => setTimeout(fn, ms) }) {
    const count = { sent: 0, skipped: 0, stale: 0, healed: 0 };
    let owed = false;
    let healing = null;
    let polls = 0;

    const host = () => { const api = sdk(); return api && typeof api.query === 'function' && typeof api.command === 'function' ? api : null; };
    const on = api => { try { return api.query('people.mirrorOn', {}) === true; } catch { return false; } };
    const stored = api => { try { return api.query('people.hash', {}) ?? null; } catch { return null; } };
    const keyOf = source => (source && typeof source === 'object' ? { sid: source.sid, swipeKey: source.swipeKey } : null);

    /** Mirrors `state` at `source`; true when the host holds it afterwards (or it is not wanted), false when it is owed. */
    async function send(api, state, source) {
        const built = view(state, { warn });
        if (!built) { owed = true; return false; }
        if (stored(api) === hash(built)) { owed = false; count.skipped += 1; return true; }
        const key = keyOf(source);
        if (!key || key.sid === undefined) { owed = true; return false; }
        let out;
        try { out = await api.command('people.mirror', { v: 1, source: key, view: built }, { background: true }); } catch (error) { out = { ok: false, code: 'FAILED', message: String(error?.message ?? error) }; }
        if (out?.ok === false) {
            owed = true;
            if (out.code === 'STALE') count.stale += 1;
            else if (out.code !== 'OFF') warn(`NPC State Delta could not mirror the people (${out.code}): ${out.message ?? ''}`);
            return false;
        }
        owed = false;
        count.sent += 1;
        return true;
    }

    /** After a publication (`ok`): the published state, never the live one. */
    async function onPublished({ state, source } = {}) {
        const api = host();
        if (!api || !on(api) || !state) return { sent: false, off: true };
        return { sent: await send(api, state, source) };
    }

    async function healNow() {
        const api = host();
        if (!api || !on(api)) return { healed: false, off: true };
        const ready = (await settled()) === true && (await idle(0)) !== false && !catchUp();
        if (!ready) {
            if (polls < HEAL_POLLS) { polls += 1; schedule(() => { void heal(); }, HEAL_POLL_MS); }
            return { healed: false, waiting: true };
        }
        polls = 0;
        const built = view(readState(), { warn });
        if (!built || stored(api) === hash(built)) { owed = false; return { healed: false }; }
        let head;
        try { head = await api.timeline?.head?.(); } catch { head = null; }
        if (!head?.ok || !head.source) { owed = true; return { healed: false, waiting: true }; }
        const done = await send(api, readState(), head.source);
        if (done) count.healed += 1;
        return { healed: done };
    }

    /** Brings the host's people into line with the live state once the barrier is down, scans are idle and no catch-up runs. One heal at a time. */
    function heal() {
        if (healing) return healing;
        healing = healNow().finally(() => { healing = null; });
        return healing;
    }

    function start() {
        const api = host();
        const off = typeof api?.on === 'function' ? api.on('head', () => { void heal(); }) : null;
        return () => { try { off?.(); } catch { /* gone */ } };
    }

    return { onPublished, heal, start, stats: () => ({ ...count, owed }) };
}
