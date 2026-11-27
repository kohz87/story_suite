// A story line that writes a name several living people share, each with a nickname: it goes to the one of them the reply's scene has, else it is refused and
// nothing is written. `Name "Nickname"` (as the people list shows them) names that one. Where anyone of the name lacks a nickname, the line is left as it is.
// The people and the scene are the reply's own, so a swipe, a Re-read and a replay decide the same way.
import { labelKey } from '../../dossier/cast-dossier-parts/shared-text.js';
import { namesakes, whichRefusal } from '../npc-meters-parts/namesakes.js';
import { isNoteKind } from '../../notes/npc-notes-kinds.js';

const PERSON_KINDS = new Set(['npc', 'milestone', 'memory', 'reveal']);

/** The members of `group` the reply's scene has (../npc-meters-parts/namesakes.js `present`). */
function presentOf(ctx, read, group) {
    let scene = [];
    try { scene = ctx.query('scene.present', {}); } catch { scene = []; }
    return read.present(group, scene);
}

/** → the person `name` names ({ id, record, nick }) when it is a shared name or a shown form; null for any other name. Refuses an unsettled shared name. */
function whom(ctx, read, name) {
    // (a form of a name only one stored person has is left to the ordinary lookup, ./names.js)
    const exact = read.asForm(name)?.one;
    if (exact && read.list.filter(record => labelKey(record.name) === labelKey(exact.record.name)).length > 1) return exact;
    const group = read.group(name);
    if (!group) return null;
    const here = presentOf(ctx, read, group);
    if (here.length !== 1) ctx.fail('REFUSED', whichRefusal(group));
    return here[0];
}

/** `apply` behind that rule: the line goes on under the person's name with their id (`personId`); a tie's `with:` names them by their nickname. */
export function toNamesake(apply) {
    return (ctx, line = {}) => {
        if (!(PERSON_KINDS.has(line.kind) || isNoteKind(line.kind)) || (line.kind === 'npc' && line.op === '+')) return apply(ctx, line);
        const label = line.kind === 'tie' ? Object.keys(line.labels ?? {}).find(key => labelKey(key) === 'with') : null;
        const written = label ? String(line.labels[label] ?? '').trim() : '';
        const read = namesakes(ctx.read('people'));
        if (!read.groups.length && !/["“]/.test(`${line.name ?? ''}${written}`)) return apply(ctx, line);
        let next = line;
        const subject = whom(ctx, read, line.name);
        if (subject) next = { ...next, name: subject.record.name, personId: subject.id };
        const other = label ? whom(ctx, read, written) : null;
        if (other) next = { ...next, labels: { ...next.labels, [label]: other.nick } };
        return apply(ctx, next);
    };
}
