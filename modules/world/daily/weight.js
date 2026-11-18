// World events, the daily step: an outcome weight read on the day it resolves (spec ruling 26). A number (0 or more), a ref (`power:<id>`,
// `score:<id>`, `standing:<id>`: the live value + 100, so 0..200), or a sum or difference of those and numbers ("200 - power:house-varn"
// is "the weakest falls"); no multiplication; clamped to at least 0. `standing:` is the player's favour, which the step does not hold: it reads as 0 (100). Pure.

const TERM = /^(?:(\d+(?:\.\d+)?)|(power|score|standing):\s*(\S.*))$/;

/** The weight's value on the step's standings, or 0 when it cannot be read. */
export function weightValue(ws, weight) {
    if (typeof weight === 'number') return Number.isFinite(weight) ? Math.max(0, weight) : 0;
    if (typeof weight !== 'string' || !weight.trim() || /[*/×÷()]/.test(weight)) return 0;
    const parts = weight.trim().split(/\s+([+-])\s+/);
    let total = 0;
    for (let at = 0; at < parts.length; at += 2) {
        const match = TERM.exec(parts[at].trim());
        if (!match) return 0;
        const sign = at === 0 || parts[at - 1] === '+' ? 1 : -1;
        const value = match[1] !== undefined ? Number(match[1]) : match[2] === 'standing' ? 100 : (ws.standings[ws.standingKey(match[2], match[3].trim())] ?? NaN) + 100;
        if (!Number.isFinite(value)) return 0;
        total += sign * value;
    }
    return Math.max(0, total);
}
