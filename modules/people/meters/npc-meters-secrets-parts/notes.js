// Hidden notes from a dossier record or a scan, cleaned, and the stable id a note gets from its rule and text.
import { BUILT_IN_METERS, clean, intOr, isObject, MAX_GENERATED_SECRETS, MAX_SECRETS, NOTE_SOURCES, SECRET_TEXT_MAX, SECRET_TITLE_MAX, SECRET_WHEN_MAX, slug } from '../npc-meters-config.js';

/**
 * Hidden notes from a dossier record, cleaned: [{ id, meter?, at?, when?, text, title? }] (at most
 * eight). A note needs text and a rule: a meter id with a whole-number `at`, a story event (`when`,
 * up to 120 characters), or both (it opens by whichever comes first). The id comes from the rule and
 * the text only, so giving a note a title never locks it again. `from` says a note is not the reader's: 'pack' (the cast's) or 'scan'
 * (written for a new dossier); a note with no `from` is the reader's own (every note before packs and scans wrote any), and the
 * dossier editor shows it even while locked. A note's `from` is never read from a model's answer or a pack's file.
 */
export function normalizeSecrets(list, max = MAX_SECRETS) {
    const out = [];
    for (const entry of Array.isArray(list) ? list : []) {
        if (out.length >= max) break;
        if (!isObject(entry)) continue;
        const meter = slug(entry.meter);
        const at = intOr(entry.at, null);
        const text = clean(entry.text, SECRET_TEXT_MAX);
        const when = clean(entry.when, SECRET_WHEN_MAX);
        const byMeter = Boolean(meter) && at !== null;
        if (!text || (!byMeter && !when)) continue;
        const id = typeof entry.id === 'string' && /^[a-z][a-z0-9]*_[0-9a-z]{8}$/.test(entry.id) ? entry.id : secretId(byMeter ? meter : '', byMeter ? at : 0, text, when);
        if (out.some(other => other.id === id)) continue;
        const title = clean(entry.title, SECRET_TITLE_MAX);
        out.push({ id, ...(byMeter ? { meter, at } : {}), ...(when ? { when } : {}), text, ...(title ? { title } : {}), ...(NOTE_SOURCES.includes(entry.from) ? { from: entry.from } : {}) });
    }
    return out;
}

/** A stable id for a note from its rule and text (FNV-1a): `sec_` and 8 base-36 characters. A meter note's id does not depend on `when`. */
export function secretId(meter, at, text, when = '') {
    let hash = 0x811c9dc5;
    for (const char of `${meter}|${at}|${text}${meter ? '' : `|${when}`}`) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `sec_${hash.toString(36).padStart(8, '0').slice(-8)}`;
}

/**
 * The notes a scan wrote for someone new (the model's `secrets`), cleaned: [{ id, meter?, at?, when?,
 * title?, text }], 2 to 5 of them in the order given (light to deep), at most MAX_GENERATED_SECRETS.
 * A meter rule uses one of the four built-in meters and a whole number from -100 to 100; anything else
 * must carry a story event. Fewer than one usable note gives [].
 */
export function normalizeGeneratedSecrets(list) {
    const meters = new Set(BUILT_IN_METERS.map(def => def.id));
    const usable = (Array.isArray(list) ? list : []).filter(isObject).map(entry => {
        const meter = slug(entry.meter);
        const at = intOr(entry.at, null);
        const ok = meters.has(meter) && at !== null && at >= -100 && at <= 100 && at !== 0;
        return { ...entry, id: undefined, from: 'scan', meter: ok ? meter : '', at: ok ? at : null };
    });
    return normalizeSecrets(usable, MAX_GENERATED_SECRETS);
}
