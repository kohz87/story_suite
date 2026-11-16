// Reads the labels of one `~ npc` line: meter moves (+N, -N, =N or the words up / down), impact, why, the anti-lever approach, disposition, and the
// dossier labels (goal, status, where, look, gender, age, birthday, mood). Unknown labels become problems; the rest of the line still applies.
import { normalizeApproachKind } from '../npc-meters-gate.js';
import { DISPOSITION_MAX, REASON_LABELS, clean, isObject, parseMeterValue, slug, tierOf } from '../npc-meters-config.js';
import { directionOf } from './direction.js';

export const FIELD_LABELS = Object.freeze(['goal', 'status', 'where', 'look', 'gender', 'age', 'birthday', 'mood']);

/** → { changes, words, tier, via, reason, disposition, fields, problems }; `words` are { def, dir } to price once the tier is known. */
export function readLabels(labels, { byLabel, defs, gateOn }) {
    const out = { changes: [], words: [], tier: 'ordinary', via: null, reason: '', disposition: undefined, fields: {}, problems: [] };
    for (const [label, raw] of Object.entries(isObject(labels) ? labels : {})) {
        const key = slug(label);
        if (REASON_LABELS.has(key)) { out.reason ||= clean(raw, 500); continue; }   // 240 at a word where it is kept (reasonKept)
        if (key === 'impact' && !byLabel.has(key)) { out.tier = tierOf(raw); continue; }
        // The anti-lever approach label (a feature, off: "not a meter" as before); an unknown word is no approach, quietly.
        if (key === 'via' && !byLabel.has(key) && gateOn) { out.via = normalizeApproachKind(String(raw ?? '').trim().toLowerCase()); continue; }
        if (key === 'stage' || key === 'stages') { out.problems.push(`Stages are set by code from the meters; "stage: ${clean(raw, 60)}" was not used.`); continue; }
        if (key === 'disposition') { out.disposition = clean(raw, DISPOSITION_MAX); continue; }
        const def = byLabel.get(key);
        if (!def && FIELD_LABELS.includes(key)) { out.fields[key] = clean(raw, 300); continue; }
        if (!def) { out.problems.push(`"${clean(label, 40)}" is not a meter (meters: ${defs.map(item => item.id).join(', ')}).`); continue; }
        const dir = directionOf(raw);
        if (dir) { out.words.push({ def, dir }); continue; }
        const parsed = parseMeterValue(raw);
        if (!parsed) { out.problems.push(`${def.label}: "${clean(raw, 40)}" is not up, down, +N, -N or =N.`); continue; }
        out.changes.push({ meter: def.id, ...parsed });
    }
    return out;
}
