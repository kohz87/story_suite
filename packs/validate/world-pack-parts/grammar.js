// The job: reading the spec's one-line strings at install: a condition "<name>@<ref>[: <duration>]", an anchor with an offset, a threshold.
// Each returns a plain record, or `{ error }` saying why the line is not that kind of entry. Pure.

import { durationDays } from '../../../modules/world/daily/durations.js';

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ANCHOR_KINDS = Object.freeze(['set', 'cleared', 'fired', 'ended', 'lapsed', 'died', 'departed', 'fact', 'stage', 'learned']);
const PLACEHOLDERS = Object.freeze(['place', 'region', 'route', 'realm']);

/** "<condition>@<ref>[: <duration>]" → { name, ref, placeholder, duration }. `duration` 'forbid' refuses one (clear, likelier_if, needs). */
export function parseCondition(text, { duration = 'allow' } = {}) {
    if (typeof text !== 'string' || !text.includes('@')) return { error: `"${String(text)}" is not a condition: write <condition>@<place, route, region or realm>, like grain-dear@highmark.` };
    const raw = text.trim();
    const cut = raw.indexOf('@');
    const name = raw.slice(0, cut).trim();
    let rest = raw.slice(cut + 1);
    let when = null;
    const colon = rest.indexOf(': ');
    if (colon >= 0) { when = rest.slice(colon + 2).trim(); rest = rest.slice(0, colon); }
    const ref = rest.trim().replace(/^@/, '');
    if (!NAME.test(name)) return { error: `"${raw}": the condition name "${name}" must be lower-case words joined by "-".` };
    if (!ref) return { error: `"${raw}" names no place, route, region or realm after the "@".` };
    if (when !== null && duration === 'forbid') return { error: `"${raw}" carries a duration; a duration belongs only where a condition is set.` };
    if (when !== null && durationDays(when, { open: true }) === undefined) return { error: `"${raw}": "${when}" is not a duration (like "10 days", "1 season" or "until cleared").` };
    const bare = ref.toLowerCase();
    const placeholder = PLACEHOLDERS.includes(bare) ? bare : null;
    return { name, ref, placeholder, duration: when };
}

/** "power:<id> >= N" / "score:<id> <= N" → { kind, id, op, n }. Anything else with that head is an error naming the rule broken. */
export function parseThreshold(text) {
    const raw = typeof text === 'string' ? text.trim() : '';
    const head = /^(power|score):\s*(.*)$/.exec(raw);
    if (!head) return { error: `"${raw}" is not a threshold.` };
    const body = /^(\S.*?)\s*(>=|<=|>|<|==|=)\s*(-?\d+(?:\.\d+)?)$/.exec(head[2]);
    if (!body) return { error: `"${raw}" is not a threshold: write ${head[1]}:<id> >= N or ${head[1]}:<id> <= N.` };
    const [, id, op, n] = body;
    if (op !== '>=' && op !== '<=') return { error: `"${raw}" compares with "${op}"; only >= and <= exist.` };
    if (!NAME.test(id)) return { error: `"${raw}" names "${id}": a threshold uses the power's or score's id (lower-case-with-hyphens), not its display name.` };
    if (!Number.isInteger(Number(n))) return { error: `"${raw}": N must be a whole number.` };
    return { kind: head[1], id, op, n: Number(n) };
}

/** An anchor ("fired:x + 90 days", "spring", "start") → { kind, id, offset }; a season name is kind 'season'. */
export function parseAnchor(text) {
    const raw = typeof text === 'string' ? text.trim() : '';
    const plus = raw.lastIndexOf(' + ');
    const head = plus < 0 ? raw : raw.slice(0, plus).trim();
    let offset = 0;
    if (plus >= 0) {
        offset = durationDays(raw.slice(plus + 3));
        if (offset === undefined) return { error: `"${raw}": "${raw.slice(plus + 3)}" is not a duration (like "3 days").` };
    }
    if (head === 'start') return { kind: 'start', id: '', offset };
    const cut = head.indexOf(':');
    if (cut < 0) return NAME.test(head) ? { kind: 'season', id: head, offset } : { error: `"${raw}" is not an anchor (set:, cleared:, fired:, ended:, lapsed:, died:, departed:, fact:, stage:, learned:, a season or start).` };
    const kind = head.slice(0, cut);
    const id = head.slice(cut + 1).trim();
    if (!ANCHOR_KINDS.includes(kind)) return { error: `"${raw}": "${kind}:" is not an anchor kind (${ANCHOR_KINDS.join(', ')}).` };
    if (!id) return { error: `"${raw}" names nothing after "${kind}:".` };
    return { kind, id, offset };
}

/** One requires-style entry → { type: 'threshold' | 'anchor' | 'condition', ...record }. */
export function parseEntry(text) {
    const raw = typeof text === 'string' ? text.trim() : '';
    if (/^(power|score):/.test(raw)) return { type: 'threshold', ...parseThreshold(raw) };
    if (/^(set|cleared):/.test(raw) && raw.includes('@')) {
        const anchor = parseAnchor(raw.replace(/@.*?(?= \+ |$)/, ''));
        return anchor.error ? { type: 'anchor', ...anchor } : { type: 'anchor', ...anchor, ref: raw.slice(raw.indexOf('@') + 1).replace(/ \+ .*$/, '') };
    }
    if (/^(set|cleared|fired|ended|lapsed|died|departed|fact|stage|learned):|^start\b/.test(raw)) return { type: 'anchor', ...parseAnchor(raw) };
    if (raw.includes('@')) return { type: 'condition', ...parseCondition(raw, { duration: 'forbid' }) };
    return { type: 'anchor', ...parseAnchor(raw) };
}
