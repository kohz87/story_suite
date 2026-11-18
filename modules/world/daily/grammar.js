// World events, the daily step: the spec's condition and anchor strings as the step reads them (world-pack-spec v0.10 §2, §3). Pure.
//   conditions  "<condition>@<ref>[: <duration>]" (one string syntax everywhere; no object form)
//   anchors     "fired:<event>[ + <duration>]", "set:<condition>[@ref]", "learned:<cast id>/<secret id>", "start", … (§3 Anchors)

import { durationDays } from './durations.js';

const PLACEHOLDERS = Object.freeze(['place', 'region', 'route', 'realm']);

/** "<condition>@<ref>[: <duration>]" → `{ name, ref, placeholder, duration }` (duration the raw text or null), or null. */
export function conditionString(text) {
    if (typeof text !== 'string') return null;
    const raw = text.trim();
    const cut = raw.indexOf('@');
    if (cut <= 0) return null;
    const name = raw.slice(0, cut).trim();
    let rest = raw.slice(cut + 1);
    let duration = null;
    const colon = rest.lastIndexOf(':');
    if (colon >= 0) {
        duration = rest.slice(colon + 1).trim();
        rest = rest.slice(0, colon);
    }
    const ref = rest.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !ref) return null;
    const bare = ref.replace(/^@/, '').toLowerCase();
    return { name, ref, placeholder: PLACEHOLDERS.includes(bare) && (ref.startsWith('@') || ref === bare) ? bare : null, duration: duration || null };
}

/** An anchor with an optional offset ("fired:succession-crisis + 90 days") → `{ kind, id, offset }` (offset in unscaled days), or null. */
export function anchorString(text) {
    if (typeof text !== 'string') return null;
    const raw = text.trim();
    const plus = raw.lastIndexOf(' + ');
    const head = plus < 0 ? raw : raw.slice(0, plus).trim();
    const offset = plus < 0 ? 0 : durationDays(raw.slice(plus + 3));
    if (offset === undefined || offset === null) return null;
    if (head === 'start') return { kind: 'start', id: '', offset };
    if (['spring', 'summer', 'autumn', 'winter'].includes(head)) return { kind: 'season', id: head, offset };
    const cut = head.indexOf(':');
    if (cut <= 0) return null;
    const kind = head.slice(0, cut);
    const id = head.slice(cut + 1).trim();
    if (!['set', 'cleared', 'fired', 'ended', 'lapsed', 'died', 'departed', 'fact', 'stage', 'learned', 'date'].includes(kind) || !id) return null;
    return { kind, id, offset };
}

/** A requirement entry is a condition string (it has "@" and no anchor head) or an anchor. */
export const isConditionEntry = text => typeof text === 'string' && text.includes('@') && !/^(set|cleared):/.test(text.trim());
