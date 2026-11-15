// Story Director v2, chronicle part: folding day-facts entries into a day's facts. Pure.

import { MAX_NPCS, MAX_PLACES, MAX_QUESTS } from './digest-caps.js';
import { MAX_MET } from './entry-caps.js';
import { entryOf } from './facts-entry.js';
import { itemOf, keyOf, pickHappened, pushUnique } from './shared-facts.js';
import { cut, dayOf, flat } from './shared-text.js';
import { isInt, isRecord } from './shared-values.js';
import { MAX_ITEM, MAX_WORLD } from './text-caps.js';

/** Entries of one day merged into one (in their order): what a fold keeps (see digest.js). */
export function foldEntries(entries, day) {
    const out = { day, count: 0, happened: [], more: 0, places: [], fights: { count: 0, won: 0, lost: 0, fled: 0 }, money: { in: 0, out: 0 }, npcs: [], world: [], revs: [] };
    const candidates = [];
    const seenHappened = new Set();
    const seenPlaces = new Set();
    const npcMoves = new Map();
    const world = new Map();
    const met = [];
    const seenMet = new Set();
    const revs = [];
    for (const entry of entries) {
        out.count += entry.count;
        out.more += entry.more;
        for (const item of entry.happened) {
            if (seenHappened.has(item.text)) continue;
            seenHappened.add(item.text);
            candidates.push({ ...item, at: candidates.length });
        }
        for (const place of entry.places) pushUnique(out.places, place, MAX_PLACES, seenPlaces);
        for (const name of ['count', 'won', 'lost', 'fled']) out.fights[name] += entry.fights[name];
        out.money.in += entry.money.in;
        out.money.out += entry.money.out;
        for (const move of entry.npcs) {
            const key = `${keyOf(move.name)}\u0000${move.meter}`;
            const before = npcMoves.get(key);
            npcMoves.set(key, { ...move, from: before ? before.from : move.from });
        }
        for (const item of entry.world) {
            world.delete(item.id);
            world.set(item.id, item.text);
        }
        for (const name of Array.isArray(entry.met) ? entry.met : []) pushUnique(met, name, MAX_MET, seenMet);
        revs.push(...entry.revs);
    }
    const kept = pickHappened(candidates);
    out.happened = kept.map(itemOf);
    out.more += candidates.length - kept.length;
    out.npcs = [...npcMoves.values()].slice(0, MAX_NPCS * 2);
    out.world = [...world].slice(-MAX_WORLD).map(([id, said]) => ({ id, text: said }));
    out.revs = revs.length ? [Math.min(...revs), Math.max(...revs)] : [];
    if (met.length) out.met = met;
    return out;
}

/**
 * A day's facts out of its entries (entryOf, in order) and the state now (the threads' `taken` and
 * `ended` stamps; `dayOfRev(rev)` → the day a receipt revision belongs to, or null):
 * `{ count, happened, more, places, quests, fights, money, npcs, world }`.
 */
export function factsOf(entries, { state = null, day = null, dayOfRev = () => null } = {}) {
    const merged = foldEntries(entries, day);
    const npcs = merged.npcs.filter(move => move.from !== move.to).slice(0, MAX_NPCS)
        .map(move => cut(`${flat(move.name)}: ${move.meter} ${move.from ? `${flat(move.from)} → ` : '→ '}${move.to ? flat(move.to) : 'none'}`, MAX_ITEM));
    return {
        count: merged.count,
        happened: merged.happened.map(item => item.text),
        // What kind each line is (parallel to `happened`): its receipt type, then its thread id, "" when unknown.
        tags: merged.happened.map(item => (item.type || item.thread ? [item.type || '-', item.thread].filter(Boolean).join(' ') : '')),
        // Who was there at each line (parallel to `happened`): the names of the entry's `who`, [] for a line without (an older day).
        who: merged.happened.map(item => (Array.isArray(item.who) ? [...item.who] : [])),
        more: merged.more,
        places: merged.places,
        quests: questsOf(state, { dayOfRev, day }),
        fights: merged.fights,
        money: merged.money,
        npcs,
        world: merged.world.map(item => item.text),
        revs: merged.revs,
        ...(merged.met?.length ? { met: [...merged.met] } : {}),
    };
}

/**
 * The facts of `day` from its receipts (in order), the day of every receipt revision (`revDay`, from
 * walkDays) and the state now: what factsOf gives for one entry of those receipts.
 */
export function dayFacts(receipts, { revDay = new Map(), state = null, day = null, lasting = null } = {}) {
    return factsOf([entryOf(receipts, day, { lasting })], { state, day, dayOfRev: rev => (revDay.has(rev) ? revDay.get(rev) : null) });
}

// The quests taken on and ended on that day, by the stamps the threads keep: the day of the receipt
// whose revision a stamp names, else the day of its story minutes.
function questsOf(state, { dayOfRev, day }) {
    const out = { taken: [], done: [], failed: [], dropped: [] };
    const seen = { taken: new Set(), done: new Set(), failed: new Set(), dropped: new Set() };
    const threads = Object.values(isRecord(state?.domains?.director?.threads) ? state.domains.director.threads : {})
        .filter(isRecord)
        .sort((a, b) => (a.track?.order ?? 0) - (b.track?.order ?? 0) || (String(a.id) < String(b.id) ? -1 : 1));
    const onDay = stamp => {
        if (!isRecord(stamp) || day === null) return false;
        const known = isInt(stamp.rev) ? dayOfRev(stamp.rev) : null;
        if (known !== null && known !== undefined) return known === day;
        return isInt(stamp.at) && dayOf(stamp.at) === day;
    };
    for (const thread of threads) {
        const quest = thread.kind === 'quest' || Boolean(thread.taken);
        if (!quest) continue;
        if (thread.taken && onDay(thread.taken)) pushUnique(out.taken, thread.key, MAX_QUESTS, seen.taken);
        if (thread.status !== 'active' && thread.ended && onDay(thread.ended)) {
            const outcome = thread.ended.outcome;
            if (outcome === 'done') pushUnique(out.done, thread.key, MAX_QUESTS, seen.done);
            else if (outcome === 'failed') pushUnique(out.failed, thread.key, MAX_QUESTS, seen.failed);
            // A declined offer or a superseded thread was never on the party's hands.
            else if (outcome === 'abandoned' || (thread.taken && outcome !== 'declined' && outcome !== 'superseded')) pushUnique(out.dropped, thread.key, MAX_QUESTS, seen.dropped);
        }
    }
    return out;
}

/** Whether facts hold anything at all. */
export const hasFacts = facts => Boolean(facts && facts.count > 0);
