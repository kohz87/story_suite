// Story Director v2, chronicle part: builds day-facts entries, scene rosters, and event lists from receipts.

import {
    ECHO, MAX_ITEM, MAX_MET, MAX_NAME, MAX_NPCS, MAX_PLACES,
    MAX_WHO, MAX_WORLD, PLANNED_TYPES, PRESENT_TYPES, SCENE_TYPES, TOLD_ELSEWHERE, clockSet, cut, flat,
    DM_TYPES, isBookkeeping, isInt, isRecord, quiet, text,
} from '../shared.js';
import { itemOf, keyOf, pickHappened, pushUnique } from './shared.js';

// Plain descriptions Story Block lets a present list hold ("- present clerk", "+ present the collectors"): not people with names.
const NOT_NAMES = /^(?:the|an?|some|several|many|few|all|both|another|other|one|two|three|four|five|six|seven|eight|nine|ten|dozens?|guards?|crowd|clerks?|collectors?|villagers?|soldiers?|townsfolk|servants?|merchants?|customers?|patrons?|strangers?|man|woman|men|women|children|people|everyone|nobody|someone)(?![\p{L}\p{N}])/iu;
const isNamed = name => /^\p{L}/u.test(name) && !/^\p{Ll}/u.test(name) && !NOT_NAMES.test(name);

// The people of a present list (named people only, once each, in order, at most MAX_WHO).
function namesOf(list) {
    const out = [];
    const seen = new Set();
    for (const name of list) if (typeof name === 'string' && isNamed(flat(name))) pushUnique(out, name, MAX_WHO, seen);
    return out;
}

/** The scene after a run of receipts: `present` (the people in it before) moved on by each present receipt's `data.present`. */
export function sceneOf(receipts, present = []) {
    let scene = namesOf(present);
    for (const receipt of receipts) if (SCENE_TYPES.has(receipt?.type) && Array.isArray(receipt.data?.present)) scene = namesOf(receipt.data.present);
    return scene;
}

// The money a receipt says moved for the party: { in, out } (whole numbers, smallest unit).
function moneyOf(receipt) {
    const data = isRecord(receipt.data) ? receipt.data : {};
    const amount = value => (isInt(value) && value > 0 ? value : 0);
    const out = { in: 0, out: 0 };
    // Story Block's wallet: the reader's or a module's top-level wallet commands, and the story's coin lines.
    if (data.owner === 'party' && isInt(data.amount)) {
        if (receipt.type === 'wallet.receive') out.in += amount(data.amount);
        else if (receipt.type === 'wallet.pay') out.out += amount(data.amount);
        else if (receipt.type === 'capture.coin') {
            const said = text(receipt.summary);
            if (/ receives /.test(said)) out.in += amount(data.amount);
            else if (/ pays /.test(said)) out.out += amount(data.amount);
        }
    }
    // A quest turned in (the quests part's own receipt, or the tracker's story turn-in carrying it).
    out.in += amount(data.paid?.amount);
    // A Director line that also paid turn-ins its reply left waiting carries each under `settled`.
    if (Array.isArray(data.settled)) for (const item of data.settled) out.in += amount(item?.turnIn?.paid?.amount);
    else out.in += amount(data.turnIn?.paid?.amount);
    return out;
}

// A module can report a finished encounter in its receipt.
function fightOf(receipt) {
    const data = receipt.data;
    // The fight board's result line ("Fight won: Astra +60 XP."): a fight of the day all the same.
    if (receipt.type === 'rpg.fight') return /^Fight (won|lost|fled)\b/i.exec(text(receipt.summary))?.[1].toLowerCase() ?? null;
    if (!['combat.end', 'combat.flee'].includes(receipt.type) || !isRecord(data) || typeof data.session !== 'string') return null;
    return ['won', 'lost', 'fled'].includes(data.outcome) ? data.outcome : null;
}

/**
 * What a run of receipts (one reply's, on one day) holds, as a day-facts entry is kept
 * (`chronicle.dayFacts`): `{ day, count, happened: [{ text, told, type?, thread? }], more, places, fights, money,
 * npcs: [{ name, meter, from, to }], world: [{ id, text }], revs: [first, last] }`. `who` on a happened line: the people in the scene
 * then (the last present receipt's `data.present`, `present` the scene the walk starts with); only when `present` is an array (notes, not an older day read back). Quests are not in
 * it: they are read from the threads' own stamps when the day is written. `lasting(rev)` (queries.js) gives
 * the entries a pack event's `chronicle.lasting` step wrote at that revision, for the day's world lines.
 */
export function entryOf(receipts, day = null, { lasting = null, present = null } = {}) {
    let scene = Array.isArray(present) ? namesOf(present) : null;
    const candidates = [];
    const seenHappened = new Set();
    const places = [];
    const seenPlaces = new Set();
    const fights = { count: 0, won: 0, lost: 0, fled: 0 };
    const money = { in: 0, out: 0 };
    const npcMoves = new Map();
    const world = new Map();
    const met = [];
    const seenMet = new Set();
    const revs = [];
    let count = 0;
    for (const receipt of receipts) {
        if (isInt(receipt.rev)) revs.push(receipt.rev);
        // Bookkeeping and the clock's own receipts are no fact of the day (a day only slept through has none).
        if (quiet(receipt) || clockSet(receipt) || PLANNED_TYPES.has(receipt.type)) continue;
        count += 1;
        const data = isRecord(receipt.data) ? receipt.data : {};
        // The scene after this receipt's own change: the one who came in (or went out, or was left behind by a move) with it was there for the line.
        if (scene && SCENE_TYPES.has(receipt.type) && Array.isArray(data.present)) scene = namesOf(data.present);
        const said = cut(receipt.summary, MAX_ITEM);
        const happened = happenedText(receipt);
        if (happened && !seenHappened.has(happened)) {
            seenHappened.add(happened);
            // The receipt's type (what kind of line it is) and the thread it touched stay with the line, for the Journal's kinds.
            const thread = typeof data.thread === 'string' ? data.thread : typeof data.quest === 'string' ? data.quest : '';
            candidates.push({ text: happened, told: receipt.narrate === true, at: candidates.length, ...tagOf(typeOf(receipt), thread), ...(scene?.length ? { who: scene } : {}) });
        }
        if (receipt.type === 'capture.place' && data.moved === true) pushUnique(places, data.name, MAX_PLACES, seenPlaces);
        // Story Block's scene: who came into the scene (`+ present`, the reader's scene.present).
        if (PRESENT_TYPES.has(receipt.type) && Array.isArray(data.added)) for (const name of data.added) pushUnique(met, name, MAX_MET, seenMet);
        const fight = fightOf(receipt);
        if (fight) {
            fights.count += 1;
            fights[fight] += 1;
        }
        const moved = moneyOf(receipt);
        money.in += moved.in;
        money.out += moved.out;
        // NPC State Delta: a meter crossed a stage (its receipt's data, code-made).
        if (typeof data.name === 'string' && Array.isArray(data.stages)) {
            for (const move of data.stages) {
                if (!isRecord(move) || typeof move.meter !== 'string') continue;
                const key = `${keyOf(data.name)}\u0000${move.meter}`;
                const before = npcMoves.get(key);
                npcMoves.set(key, { name: cut(data.name, MAX_NAME), meter: cut(move.meter, MAX_NAME), from: before ? before.from : textOrNull(move.from), to: textOrNull(move.to) });
            }
        }
        // A pack event's lasting changes (its receipt tells the cue; `lasting(rev)` gives what it wrote).
        if (lasting && receipt.type === 'events.fire' && Array.isArray(data.then) && data.then.includes('chronicle.lasting') && typeof data.event === 'string') {
            for (const item of lasting(receipt.rev)) {
                if (item.by !== `event:${data.event}` || !item.text) continue;
                const id = cut(item.id, MAX_NAME);
                world.delete(id);
                world.set(id, cut(item.text, MAX_ITEM));
            }
        }
        // The chronicle's own world lines: the last summary of each event that day.
        if (receipt.type === 'capture.world' && said && (receipt.module === undefined || receipt.module === 'story-director')) {
            const id = cut(typeof data.event === 'string' ? data.event : said, MAX_NAME);
            world.delete(id);
            world.set(id, said);
        }
    }
    const kept = pickHappened(candidates);
    return {
        day,
        count,
        happened: kept.map(itemOf),
        more: candidates.length - kept.length,
        places,
        fights,
        money,
        npcs: [...npcMoves.values()].slice(0, MAX_NPCS * 2),
        world: [...world].slice(-MAX_WORLD).map(([id, said]) => ({ id, text: said })),
        revs: revs.length ? [Math.min(...revs), Math.max(...revs)] : [],
        ...(met.length ? { met } : {}),
    };
}

/** What a receipt tells under "happened": its summary, or '' for a receipt that is bookkeeping, told elsewhere or the model's own echo. */
function happenedText(receipt) {
    if (isBookkeeping(receipt) || TOLD_ELSEWHERE.has(receipt.type)) return '';
    const said = cut(receipt.summary, MAX_ITEM);
    return said && !ECHO.test(said) ? said : '';
}

/** Every event of one day, in chat order, by the rules entryOf picks from (not stored): `[text]`, at most `limit`. */
export function eventsOf(receipts, limit = 500) {
    const seen = new Set();
    const out = [];
    for (const receipt of receipts) {
        if (out.length >= limit) break;
        if (quiet(receipt) || clockSet(receipt) || PLANNED_TYPES.has(receipt.type)) continue;
        const said = happenedText(receipt);
        if (said && !seen.has(said)) {
            seen.add(said);
            out.push(said);
        }
    }
    return out;
}

// A line's kind: its receipt's type and thread id, kept only when they are short plain names (a stored entry's `type` / `thread`).
const NAMEISH = /^[A-Za-z0-9_.:-]{1,64}$/;
// A block's result line (`capture.dm` / `dm.act`) is told apart by its result kind: "capture.dm:fame-kind" (the Journal splits Fame, Standing and Guild by it).
const typeOf = receipt => {
    const kind = receipt.data?.v2?.result?.kind;
    return DM_TYPES.has(receipt.type) && typeof kind === 'string' && NAMEISH.test(kind) ? `${receipt.type}:${kind}` : receipt.type;
};
const tagOf = (type, thread) => ({ ...(NAMEISH.test(type) ? { type } : {}), ...(NAMEISH.test(thread) ? { thread } : {}) });

const textOrNull = value => (typeof value === 'string' && value ? cut(value, MAX_NAME) : null);
