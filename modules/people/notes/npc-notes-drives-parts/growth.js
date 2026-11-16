// Drive growth (rule 1): the evidence a scan recorded and the one-step-per-reply change of a drive.
import { DRIVE_MIN, DRIVE_MAX } from './shared-limits.js';
import { DRIVES } from './shared-table.js';
import { readDrives } from './stored.js';
import { serialize, readExtras } from './extras.js';
import { tokensOf } from './cues.js';
import { leverCues } from './lever.js';

// ---- growth (rule 1) ----

const textOf = item => String(typeof item === 'string' ? item : item?.text ?? item?.memory ?? '').trim();

// The text a scan newly recorded for one person (before and after: dossier records): new memories, behavior and mannerism lines,
// and the relationship reason when it changed. Plain strings, at most 12 of 200 characters; nothing new reads as [].
export function driveEvidence(before, after) {
    const out = [];
    for (const field of ['memories', 'behaviorProfile', 'mannerisms']) {
        const old = new Set((Array.isArray(before?.[field]) ? before[field] : []).map(textOf));
        for (const item of Array.isArray(after?.[field]) ? after[field] : []) {
            const text = textOf(item);
            if (text && !old.has(text)) out.push(text);
        }
    }
    const reason = String(after?.lastRelationshipChange?.reason ?? '').trim();
    if (reason && reason !== String(before?.lastRelationshipChange?.reason ?? '').trim()) out.push(reason);
    return out.slice(0, 12).map(text => text.slice(0, 200));
}

// One reply's evidence (`texts`, plain strings) against the stored leaf, for the reply `rid`: { leaf, steps } or null when nothing is
// stored or moved. A drive whose cues (and no opposite cue) show for the first time since its last change only remembers the reply; the
// same drive and direction in a DIFFERENT reply steps it one level (3 and 0 are the ends). Never more than one step per drive per reply.
export function growDrives(leaf, texts, rid, skipText) {
    const key = rid === null || rid === undefined ? '' : String(rid);
    const base = readDrives(leaf);
    if (!base || !key || key.length > 40 || !Array.isArray(texts)) return null;
    const extras = readExtras(leaf);
    const skip = new Set(tokensOf(skipText).filter(token => token.length > 1));
    const found = leverCues(texts, skip);
    const next = { ...base };
    const steps = [];
    let touched = false;
    for (const drive of DRIVES) {
        const up = found[drive.key].up;
        const down = found[drive.key].down;
        if (!up.length === !down.length) continue;   // no cue, or cues both ways: nothing to count
        const dir = up.length ? 'u' : 'd';
        const cue = (up.length ? up : down)[0];
        if (dir === 'u' ? next[drive.key] >= DRIVE_MAX : next[drive.key] <= DRIVE_MIN) continue;
        const entry = { ...(extras[drive.key] ?? {}) };
        const [pendDir, pendReply] = String(entry.e ?? '').split(':');
        if (pendDir === dir && pendReply === key) continue;   // the same reply again counts once
        touched = true;
        if (pendDir === dir && pendReply) {
            const from = next[drive.key];
            next[drive.key] = from + (dir === 'u' ? 1 : -1);
            const source = dir === 'u' ? 'u' : 'l';
            extras[drive.key] = { s: source, n: Math.min(999, (entry.s === source ? entry.n ?? 0 : 0) + 2), c: cue.slice(0, 24) };
            steps.push({ key: drive.key, label: drive.label, from, to: next[drive.key], cue });
        } else {
            extras[drive.key] = { ...entry, e: `${dir}:${key}` };
        }
    }
    return touched ? { leaf: serialize(next, extras), steps } : null;
}
