// Lists the foes' attacks in one exchange and applies the harder-foes cap.

import { packAttacks } from './pack-attacks.js';
import { groupOf } from './shared-slots.js';

/**
 * The foes' attacks in one exchange (one entry per attack, the foe on it), `foes` being the standing ones. A pack attacks as its bar allows, a member once. Under the harder-foes
 * rule (`hard`) a member that is the only one standing in its group attacks ceil(party / 2) times, and all the attacks are cut to 2 x `party` (capAttackers; `round` turns the bars spared).
 * The plan and the board's "N attacks on you" line both read this, so they cannot disagree.
 */
export function attackList(foes, party, { hard = false, round = 1 } = {}) {
    const lone = foe => hard && foe.pack !== true && foes.filter(other => groupOf(other) === groupOf(foe)).length === 1;
    const every = foes.flatMap(foe => Array.from({ length: foe.pack === true ? packAttacks(foe.count, foe.hurt, foe.size, foe.full) : lone(foe) ? Math.ceil(party / 2) : 1 }, () => foe));
    return hard ? capAttackers(every, 2 * party, round) : every;
}

/**
 * The harder-foes cap: at most `cap` attacks in one exchange. A list of attacks (one entry per attack, the foe's bar on it) over the cap is cut in proportion to what each bar
 * makes, never below one for a bar, the largest remainders taking the extra. With at least as many bars as the cap, `cap` bars attack once, starting from a bar that turns with
 * the exchange `round`, so the same bars are not spared every time. A list within the cap is returned as it is. Pure: the same list and round give the same attacks.
 */
export function capAttackers(list, cap, round = 1) {
    if (!(cap > 0) || list.length <= cap) return list;
    const bars = [...new Set(list.map(foe => foe.slot))], counts = bars.map(slot => list.filter(foe => foe.slot === slot).length);
    if (bars.length >= cap) {
        const from = ((round - 1) * cap) % bars.length;
        return Array.from({ length: cap }, (_, k) => list.find(foe => foe.slot === bars[(from + k) % bars.length]));
    }
    const total = counts.reduce((a, b) => a + b, 0), exact = counts.map(c => (c * cap) / total), keep = exact.map(x => Math.max(1, Math.floor(x)));
    let left = cap - keep.reduce((a, b) => a + b, 0);
    const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; left > 0 && k < 100; k += 1, left -= 1) {
        const i = order[k % order.length][1];
        if (keep[i] < counts[i]) keep[i] += 1;
    }
    while (keep.reduce((a, b) => a + b, 0) > cap) {
        const i = keep.indexOf(Math.max(...keep));
        if (keep[i] <= 1) break;
        keep[i] -= 1;
    }
    return bars.flatMap((slot, i) => list.filter(foe => foe.slot === slot).slice(0, keep[i]));
}
