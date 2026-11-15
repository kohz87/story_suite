// Holds on safety-net lines: the module held back for a line, and the wait while only a momentary barrier holds them.

/**
 * The module (held back: dormant, or a restore is pending) that keeps a safety-net `line` from running, as { module, name, reason, message },
 * else null: the owner of the line's kind, or one whose afterCapture hook would have run after it (a hook skipped while held runs on
 * a later Re-read, so the line would replay differently). Live and Re-read ask the same.
 */
export function heldWhy(registry, line) {
    const held = registry.heldModules?.() ?? [];
    if (!held.length) return null;
    const owner = registry.captureOwner?.(line?.kind);
    const id = held.includes(owner) ? owner : held.find(item => typeof registry.module?.(item)?.hooks?.afterCapture === 'function');
    if (!id) return null;
    const name = registry.module?.(id)?.name || id, reason = registry.lifecycle?.(id)?.reason || 'temporarily unavailable';
    return { module: id, name, reason, message: `"${line?.raw}" was not used: ${name} was held back (${reason}); this line was not used.` };
}

// A hold that is only a moment: the timeline's barrier for a native change finishing (or the chat's records being checked), which lifts by
// itself. A real restore, a save point, a dormant or switched-off module are not moments.
const MOMENT = /native change is finishing|waiting for its records/i;
// How long the safety net's lines wait for such a moment to pass (`waitMs`), checked every `pollMs`; a test may shorten them.
export const BARRIER = { waitMs: 20_000, pollMs: 50 };

/** True when `lines` are held back now and every hold is only a momentary barrier (so it is worth waiting for). */
export function momentaryHold(registry, lines) {
    let moment = false;
    for (const line of lines) {
        const held = heldWhy(registry, line);
        if (!held) continue;
        if (registry.lifecycle?.(held.module)?.status !== 'restore-pending' || !MOMENT.test(held.reason)) return false;
        moment = true;
    }
    return moment;
}

/** Waits (at most BARRIER.waitMs) while `lines` are held only by a momentary barrier; stops early when `still()` says the reply is gone. */
export async function waitForBarrier(registry, lines, still = () => true) {
    const end = Date.now() + BARRIER.waitMs;
    while (momentaryHold(registry, lines) && still() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, BARRIER.pollMs));
}
