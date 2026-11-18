// World events, the daily step: thresholds on powers and scores (spec v0.13 §3 Thresholds, ruling 18). `power:<id> >= N`,
// `power:<id> <= N`, `score:<id> >= N`, `score:<id> <= N` in `requires`, `requires_any` and `ends_when.any_of`. Checked on the
// day's value as the step holds it when the event is checked (earlier effects that day included); not latched: true only while
// the value satisfies it. The step's state is recorded whole on the reply that crossed the day, so replay never recomputes it. Pure.

const SHAPE = /^(power|score):([^\s<>=]+)\s*(>=|<=|==|>|<|=)\s*(-?\d+(?:\.\d+)?)$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const list = value => (Array.isArray(value) ? value : []);

/** Whether `text` is written as a threshold (`power:` or `score:` with a comparison), valid or not. */
export const isThreshold = text => typeof text === 'string' && /^(power|score):/.test(text.trim()) && /[<>=]/.test(text);

/** `"power:ashen-veil >= 40"` → `{ kind, id, op, n }`, or `{ why }` when it is written as a threshold but cannot be one. */
export function thresholdString(text) {
    const match = SHAPE.exec(String(text).trim());
    if (!match) return { why: `"${text}" is not "power:<id> >= N" or "<= N".` };
    const [, kind, id, op, raw] = match;
    if (op !== '>=' && op !== '<=') return { why: `"${text}" uses ${op}; only >= and <= exist.` };
    if (!ID.test(id)) return { why: `"${text}" names "${id}"; a threshold names a ${kind} id.` };
    const n = Number(raw);
    if (!Number.isInteger(n)) return { why: `"${text}": N must be a whole number.` };
    return { kind, id, op, n };
}

/**
 * Why a parsed threshold cannot be read in `world` (its `powers` / `scores`), or '': an id with no entry, or an N outside the
 * entry's range (`range: [lo, hi]`, −100..100 by default).
 */
export function thresholdProblem(parsed, world = {}) {
    const row = list(parsed.kind === 'power' ? world.powers : world.scores).find(entry => entry?.id === parsed.id);
    if (!row) return `the ${parsed.kind} id "${parsed.id}" is not in this world.`;
    const [lo, hi] = Array.isArray(row.range) && row.range.length === 2 && row.range.every(Number.isFinite) ? row.range : [-100, 100];
    return parsed.n < lo || parsed.n > hi ? `${parsed.kind}:${parsed.id} ${parsed.op} ${parsed.n} is outside ${lo}..${hi}.` : '';
}

/** Whether the threshold `text` holds on the step's standings (`ws.standings`, keyed `<kind>:<id>`); an unreadable one never holds. */
export function thresholdHolds(ws, text) {
    const parsed = thresholdString(text);
    if (parsed.why) return false;
    const value = ws.standings?.[`${parsed.kind}:${parsed.id}`];
    if (!Number.isFinite(value)) return false;
    return parsed.op === '>=' ? value >= parsed.n : value <= parsed.n;
}
