// World events, the daily step: the spec's condition and anchor strings as the step reads them (world-pack-spec v0.10 §2, §3). Pure.
//   conditions  "<condition>@<ref>[: <duration>]" (one string syntax everywhere; no object form)
//   anchors     "fired:<event>[ + <duration>]", "set:<condition>[@ref]", "learned:<cast id>/<secret id>", "start", … (§3 Anchors)
//   party       "in:<region>", "near:<region>", "in:@region", "near:@region": where the party is today (near.js)

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

const SEASON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** An anchor with an optional offset ("fired:succession-crisis + 90 days") → `{ kind, id, offset }` (offset in unscaled days), or null. */
export function anchorString(text) {
    if (typeof text !== 'string') return null;
    const raw = text.trim();
    const plus = raw.lastIndexOf(' + ');
    const head = plus < 0 ? raw : raw.slice(0, plus).trim();
    const offset = plus < 0 ? 0 : durationDays(raw.slice(plus + 3));
    if (offset === undefined || offset === null) return null;
    if (head === 'start') return { kind: 'start', id: '', offset };
    // A season by name: the four built-in quarters, or a season of the game's calendar (the pack checker reads a bare name the same way; cal.js says whether the calendar has it).
    if (SEASON_NAME.test(head)) return { kind: 'season', id: head, offset };
    const cut = head.indexOf(':');
    if (cut <= 0) return null;
    const kind = head.slice(0, cut);
    const id = head.slice(cut + 1).trim();
    if (!['set', 'cleared', 'fired', 'ended', 'lapsed', 'died', 'departed', 'fact', 'stage', 'learned', 'arc-ended', 'date'].includes(kind) || !id) return null;
    return { kind, id, offset };
}

/** A party term "in:<region>" / "near:<region>" → `{ term, ref, own }` (`own`: the ref is "@region", the event's own region), or null. */
export function partyTerm(text) {
    const match = typeof text === 'string' ? /^(in|near):\s*(\S.*)$/.exec(text.trim()) : null;
    if (!match) return null;
    const ref = match[2].trim();
    return { term: match[1], ref, own: ref.toLowerCase() === '@region' };
}

/** A requirement entry is a condition string (it has "@", no anchor head and is no party term) or an anchor. */
export const isConditionEntry = text => typeof text === 'string' && text.includes('@') && !/^(set|cleared|arc-ended|in|near):/.test(text.trim());
