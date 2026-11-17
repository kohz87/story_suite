// The job: reading an outcome weight (spec v0.14 §3): a number, a ref (`power:<id>`, `score:<id>`, `standing:<id>`), or a sum or difference of refs and numbers. Pure.
// Returns { terms: [{ sign, number } | { sign, kind, id }] } or { error }.

const TERM = /^(?:(\d+(?:\.\d+)?)|(power|score|standing):\s*(\S.*))$/;

/** "200 - power:house-varn", "power:a + power:b", 40, "power:church" → the terms, or { error } naming the rule broken. */
export function parseWeight(weight) {
    if (typeof weight === 'number') return Number.isFinite(weight) && weight >= 0 ? { terms: [{ sign: 1, number: weight }] } : { error: `a literal weight must be 0 or more (it is ${weight}).` };
    if (typeof weight !== 'string' || !weight.trim()) return { error: 'a weight is a number of 0 or more, a ref (power:<id>, score:<id>) or a sum or difference of refs and numbers.' };
    const raw = weight.trim();
    if (/[*/×÷()]/.test(raw)) return { error: `"${raw}": a weight has only + and - (no multiplication, division or brackets).` };
    // Split on a spaced + or - so a hyphenated id keeps its hyphens ("power:wendhild-court").
    const parts = raw.split(/\s+([+-])\s+/);
    const terms = [];
    for (let at = 0; at < parts.length; at += 2) {
        const text = parts[at].trim();
        const sign = at === 0 || parts[at - 1] === '+' ? 1 : -1;
        if (/^-/.test(text)) return { error: `"${raw}": a literal number must be 0 or more (a negative literal is refused); write a difference instead.` };
        const match = TERM.exec(text);
        if (!match) return { error: `"${raw}": "${text}" is not a number, power:<id>, score:<id> or standing:<id>; join terms with " + " or " - " (spaces around the sign).` };
        terms.push(match[1] !== undefined ? { sign, number: Number(match[1]) } : { sign, kind: match[2], id: match[3] });
    }
    return { terms };
}
