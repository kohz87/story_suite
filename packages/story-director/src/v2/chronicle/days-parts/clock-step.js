// Story Director v2, chronicle part: the one clock stepper. The walk (walkDays), the World screen's "heard" stamps and the
// notes' start clock all follow the clock the way Story Block replays it, so an edit or delete before a reply is followed. Pure.

import { clockSet } from './receipt-classify.js';
import { DAY_MINUTES } from './digest-constants.js';
import { isInt } from './shared-values.js';

const ROLLS = new Set(['same', 'after']);

/**
 * An anchored set (`kind` 'same' | 'after': a `~` clock face, a skip) as Story Block replays it (ops/anchored.js, the same arithmetic) on a clock
 * that holds `now`: as stored when the clock holds `from`, else its offset in whole days from `from`; 'same' never lands below `now`, 'after' lands after it.
 */
function anchoredMinutes({ minutes, from, kind, to }, now) {
    if (now === from) return minutes;
    const shift = DAY_MINUTES * (Math.floor(now / DAY_MINUTES) - Math.floor(from / DAY_MINUTES));
    if (kind === 'same') return Math.max((isInt(to) ? to : minutes) + shift, now);
    const moved = minutes + shift;
    return moved > now ? moved : moved + DAY_MINUTES;
}

/**
 * What a clock receipt did to the clock's op: 'move' (a duration or `director.advance`: Story Block replays it as `now + (minutes - from)`),
 * 'same' | 'after' (an anchored set: a `~` clock face, a skip, a bare `!` clock time, kept as its offset from the clock before it), 'set' (a date, a clock face, a skip, the reader's edit, the seed: replayed as the stored minute), or 'settle' (a checkpoint only).
 * A receipt told before kinds were written (`capture.time` without `data.kind`) is a set, as it was read before.
 */
function clockKind(receipt) {
    if (receipt.type === 'time.settle') return 'settle';
    if (receipt.type === 'director.advance') return 'move';
    if (receipt.type === 'capture.time') return ['move', 'same', 'after'].includes(receipt.data?.kind) ? receipt.data.kind : 'set';
    return 'set';
}

/**
 * The walked clock (`minutes`, or null before any) after `receipt`: a receipt that does not set the clock leaves it; a move adds
 * `data.minutes - data.from` (a move with no `from`, as a line "(not used)", adds nothing); a set takes `data.minutes`; a settle
 * only starts a clock that is not started (it is a checkpoint after that, never a move). The first clock receipt starts it either way.
 */
export function stepClock(minutes, receipt) {
    if (!clockSet(receipt)) return minutes;
    const set = receipt.data.minutes;
    if (!isInt(minutes)) return set;
    const kind = clockKind(receipt);
    if (kind === 'settle') return minutes;
    if (kind === 'set') return set;
    if (ROLLS.has(kind)) return isInt(receipt.data.from) ? anchoredMinutes(receipt.data, minutes) : minutes;
    return isInt(receipt.data.from) ? minutes + (set - receipt.data.from) : minutes;
}
