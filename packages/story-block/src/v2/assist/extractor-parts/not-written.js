// Which lines the reply's own block does not already hold: repeats and scene-kind lines are dropped.

import { parseChanges, sameChangeLine } from '../../capture.js';

// Two lines are one change when C-1 calls them the same line, or when they share op, kind and name
// (a `- item Pelt` the block wrote is not handed over twice because the extractor added a label).
const nameKey = line => `${line.op} ${String(line.kind ?? '').toLowerCase()} ${String(line.name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()}`;
// Kinds that describe the whole scene, one value at a time: where it is, when, and its weather. Once the
// reply's own block sets one of them, the safety net's line of that kind for the same reply is not used,
// whatever name it gives: another wording of the same place would read as a move and leave everyone present
// behind, and a second `! time` would move the clock on twice. A late line (the reply before's, applied after
// the next reply's own lines) that sets a value the next reply set again is older and not used either; but a
// late `! time` (time that passed in the reply before) still adds.
export const SCENE_KINDS = Object.freeze(['place', 'time', 'weather']);
const sceneKind = line => {
    const kind = String(line?.kind ?? '').toLowerCase();
    return SCENE_KINDS.includes(kind) ? kind : null;
};
/**
 * The raw lines of `lines` (raw[]) the reply's `written` lines (raw[]) do not already hold (nor repeat among
 * themselves), and none of a scene kind (SCENE_KINDS) that `scene` (raw[], default `written`: the lines that set the
 * scene, never an older reply's late lines) already sets. `late`: `lines` are late lines; a `! time` among them is kept.
 */
export function notWritten(lines, written, { scene = written, late = false } = {}) {
    const parsed = parseChanges(written.join('\n')).lines;
    const same = new Set(written.map(sameChangeLine));
    const names = new Set(parsed.map(nameKey));
    const set = new Set(parseChanges(scene.join('\n')).lines.map(sceneKind).filter(Boolean));
    const out = [];
    for (const raw of lines) {
        const line = parseChanges(raw).lines[0];
        const kind = sceneKind(line);
        const sceneSet = kind !== null && set.has(kind) && !(late && line.op === '!' && kind === 'time');
        if (!line || same.has(sameChangeLine(raw)) || names.has(nameKey(line)) || sceneSet) continue;
        same.add(sameChangeLine(raw));
        names.add(nameKey(line));
        out.push(raw);
    }
    return out;
}
