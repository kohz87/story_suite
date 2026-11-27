// Namesakes in what a scan returns and in a scene's list (the rule of story lines, ../meters/npc-meters-parts/namesakes.js): Name "Nickname" is that person,
// and a shared name every holder has a nickname for goes to the one the scene has, else to nobody. Any other row and label is left as it is.
import { cleanText, normalizeName } from './core-text.js';
import { npcMatchesLabel } from './core-record.js';
import { namesakes } from '../meters/npc-meters-parts/namesakes.js';
import { resolveNpcId } from '../social/social.js';

const ROW_LISTS = ['npcs', 'profileUpdates', 'profile_updates'];

// The stored person a row's id means, as the profile reader takes it (any spelling of one stored id, ../social/social.js); `exact`: a replay that keeps
// the old reading takes the exact id alone.
const holderOf = (npcs, id, exact = false) => (!id ? null : (exact ? npcs.find(npc => npc?.id === id) : resolveNpcId(npcs, id)) ?? null);

// A row with a stored person's id is that person's alone: it is tied when another record also answers to one of its labels. It is left untied when a
// record with a different name could be that same person (either one's name among the other's aliases or the row's labels): the merge may fold the two,
// and the row must then reach whichever record is kept.
function tieHeld(npcs, row, exact) {
    const id = row && typeof row === 'object' ? cleanText(row.id, 100) : '';
    const held = row && !row.settledId ? holderOf(npcs, id, exact) : null;
    if (!held) return row;
    const labels = [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])].filter(Boolean);
    const others = npcs.filter(npc => npc && npc !== held && labels.some(label => npcMatchesLabel(npc, label)));
    const own = normalizeName(held.name);
    const mayBeSame = other => normalizeName(other.name) !== own && ([held.name, ...(held.aliases || []), ...labels].some(label => normalizeName(label) === normalizeName(other.name))
        || [held.name, row.name].some(label => label && (other.aliases || []).some(alias => normalizeName(alias) === normalizeName(label))));
    return others.length && !others.some(mayBeSame) ? { ...row, id: held.id, settledId: held.id } : row;
}

// One row → itself, a copy tied to one person (`settledId`: matched by that id alone, ./core-mechanics/npc-matching.js), or null (nobody: dropped).
function settleRow(read, row, scene) {
    if (!row || typeof row !== 'object') return row;
    const id = cleanText(row.id, 100);
    const name = cleanText(row.name, 120);
    const form = /["“]/.test(name) ? read.asForm(name) : null;
    const tied = record => {
        const aliases = Array.isArray(row.aliases) ? row.aliases.filter(alias => !read.asForm(alias)?.found.length) : row.aliases;
        return { ...row, id: record.id, settledId: record.id, ...(form || read.group(name) ? { name: record.name } : {}), ...(aliases ? { aliases } : {}) };
    };
    const held = holderOf(read.list, id);
    if (held) return read.shown(held.id) || form?.found.some(record => record.id === held.id) ? tied(held) : row;
    if (form?.one) return tied(form.one.record);
    if (form && (form.found.length || form.group)) return null;
    const group = read.group(name);
    if (!group) return row;
    const given = new Set((Array.isArray(row.aliases) ? row.aliases : []).map(alias => cleanText(alias, 120).toLocaleLowerCase()));
    const named = group.members.filter(member => given.has(member.nick.toLocaleLowerCase()));
    const here = named.length === 1 ? named : read.present(group, scene);
    return here.length === 1 ? tied(here[0].record) : null;
}

/**
 * → { scanResult (the same object when no row is tied or dropped), skipped: [names of the dropped rows] }. `npcs`: the records as they were before the
 * scan, with their presence; `scene`: the names the reply's scene lists, when known. `idsOnly` (a replay that keeps the old reading of shared names):
 * only rows carrying a stored person's id are tied.
 */
export function settleScanRows(npcs, scanResult, scene = [], idsOnly = false) {
    const records = Array.isArray(npcs) ? npcs : [];
    const read = idsOnly ? null : namesakes(records);
    const skipped = new Set();
    let out = scanResult;
    for (const key of ROW_LISTS) {
        const rows = scanResult?.[key];
        if (!Array.isArray(rows)) continue;
        const next = [];
        let changed = false;
        for (const row of rows) {
            const named = idsOnly ? row : settleRow(read, row, scene);
            const settled = named && tieHeld(records, named, idsOnly);
            changed ||= settled !== row;
            if (settled === null && row !== null) skipped.add(cleanText(row?.name, 120));
            else next.push(settled);
        }
        if (changed) out = { ...out, [key]: next };
    }
    return { scanResult: out, skipped: [...skipped] };
}

/**
 * `scanResult` as read after the merge folded records (`folded`: report.deduplicated): a row tied to a removed id is tied to the kept one, chains
 * followed. The same object when no tie moves; rows are copied, never changed (a journal keeps them as they were: a replay folds them again).
 * `reaches(row, keptId)`, when given, can leave a row tied where it was.
 */
export function followFoldedTies(scanResult, folded, reaches = () => true) {
    const into = new Map((folded || []).map(item => [String(item.removedId), String(item.keptId)]));
    let out = scanResult;
    for (const key of ROW_LISTS) {
        const rows = scanResult?.[key];
        if (!into.size || !Array.isArray(rows) || !rows.some(row => into.has(row?.settledId))) continue;
        out = { ...out, [key]: rows.map(row => {
            let id = row?.settledId;
            while (into.has(id)) id = into.get(id);
            return id === row?.settledId || !reaches(row, id) ? row : { ...row, settledId: id };
        }) };
    }
    return out;
}

/**
 * A scene's list of names, read against `npcs` → { ids: the people named by Name "Nickname", or by a shared name the presence rule settles; rest: the
 * labels to match as written }. A shared name or shown form that settles on nobody is in neither.
 */
export function sceneTargets(npcs, labels) {
    const read = namesakes(Array.isArray(npcs) ? npcs.filter(Boolean) : []);
    const ids = new Set();
    const rest = [];
    for (const label of Array.isArray(labels) ? labels : []) {
        const text = String(label?.name ?? label ?? '');
        const form = /["“]/.test(text) ? read.asForm(text) : null;
        const group = read.group(text);
        if (form?.found.length) { if (form.one) ids.add(form.one.id); continue; }
        if (!group && !form?.group) { rest.push(label); continue; }
        const here = group ? read.present(group, labels) : [];
        if (here.length === 1) ids.add(here[0].id);
    }
    return { ids, rest };
}
