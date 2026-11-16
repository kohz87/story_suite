// The wear a fight costs the gear: which told lines were decisive and the condition steps taken from worn pieces.
import { fold } from '../read.js';

/** Whether a told Line was decisive: Standard's lines say so; an older line is a natural 1 or 20 on either die or a margin either way. */
export function isDecisive(line, rules) {
    if (typeof line?.decisive === 'boolean') return line.decisive;
    if (!line?.foe || !Number.isFinite(line.pc?.die) || !Number.isFinite(line.foe.die)) return false;
    return [line.pc.die, line.foe.die].some(die => die === 1 || die === 20) || Math.abs(line.pc.total - line.foe.total) >= (rules?.decisiveMargin ?? Infinity);
}

/**
 * The wear the told rounds cost: a decisive hit taken wears the one hit's body armour (else off-hand), a decisive miss of an act their weapon, one step each
 * (`ctx.call('gear.wear')`; a piece already broken, or no piece, wears nothing). `opening` lines come before round 1. → [{ n, who, item, from, to }], recorded in the result.
 * `condWord(cond)` names a condition. Nothing happens while the inventory answers no gear (the switch went off).
 */
export function wearGear(ctx, gear, { opening = [], rounds = [], rules, condWord, stepDown = null }) {
    const events = [];
    // `stepDown(cond)` given: a dry run (nothing is called; the conditions are walked down here), what the cue is fitted with so the wear lines count in its budget.
    const dry = typeof stepDown === 'function', conds = new Map();
    // (decided by the record the roll carries, not by today's switch: a roll made with gear keeps the wear it made when it is read again with the switch off)
    if (!gear) return events;
    const told = [...opening.map(line => ({ n: rounds[0]?.n ?? 1, line })), ...rounds.flatMap(round => round.lines.map(line => ({ n: round.n, line })))];
    for (const { n, line } of told) {
        if (!['act', 'foe'].includes(line.kind) || line.support || line.aoeFollowup === true || line.outcome !== 'fail' || !isDecisive(line, rules)) continue;
        const slots = line.kind === 'foe' ? ['body', 'off-hand'] : ['weapon'];
        for (const owner of gear.who?.[fold(line.pc.who)]?.own ?? []) {
            const worn = ctx.query('inventory.gear', { owner, recorded: true })?.slots ?? {};
            // (what a hit taken wears is the body armour, else the off-hand, as `gear.wear defence` picks it)
            const place = line.kind === 'foe' ? (worn.body ? 'body' : worn['off-hand'] ? 'off-hand' : null) : (worn.weapon ? 'weapon' : null);
            const mark = `${owner}/${place}`;
            if (!place || (dry ? (conds.get(mark) ?? worn[place].cond) <= 0 : worn[place].broken === true)) continue;
            let data;
            if (dry) { const before = conds.get(mark) ?? worn[place].cond; data = { before, now: stepDown(before, 1) }; conds.set(mark, data.now); }
            else data = ctx.call('gear.wear', { owner, slot: line.kind === 'foe' ? 'defence' : 'weapon', steps: 1, recorded: true })?.data ?? {};
            events.push({ n, who: line.pc.who, item: worn[place].name, from: condWord(data.before), to: condWord(data.now) });
            break;
        }
    }
    return events;
}
