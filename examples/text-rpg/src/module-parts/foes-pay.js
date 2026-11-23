// What the foes that fell pay, under the battle's cap: each fallen foe pays its kind's XP times the threat's multiplier, and one battle (a fight and the waves that joined it) pays no more than its strongest group's threat allows.
import { battleCap, foeXp } from '../rules/foe-ladder.js';

/** The most the battle `fight` pays: set by the strongest threat among its groups that had a foe fall or still stand (a group ended with no kills does not count). */
export function capOf(slice, fight) {
    const threats = Object.values(slice.foes?.groups ?? {}).filter(group => group.fight === fight && (!group.fled || group.fell > 0)).map(group => group.threat);
    return battleCap(threats.length ? Math.max(...threats) : 2);
}

/**
 * Pays `parts` ([{ group, count }], the foes that fell) out of the battles' caps.
 * → { raw: XP before the rate (the caller scales it, and the battle's numbers, by the rate), battle: { paid, cap } of the last battle paid or null, capped: some foe's pay was cut by the cap }.
 */
export function payParts(slice, parts) {
    let raw = 0;
    let battle = null;
    let capped = false;
    for (const { group, count } of parts) {
        if (count <= 0) continue;
        const fight = (slice.foes.fights[group.fight] ??= { rolled: {}, taught: [] });
        const cap = capOf(slice, group.fight);
        const owed = foeXp(group.kind, group.threat, count);
        const pay = Math.max(0, Math.min(owed, cap - (fight.paid ?? 0)));
        fight.paid = (fight.paid ?? 0) + pay;
        capped ||= pay < owed;
        raw += pay;
        battle = { paid: fight.paid, cap };
    }
    return { raw, battle, capped };
}
