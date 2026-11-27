// Namesakes in what a scan returns and in a scene's list (the rule of story lines, ../meters/npc-meters-parts/namesakes.js): Name "Nickname" is that person,
// and a shared name every holder has a nickname for goes to the one the scene has, else to nobody. Any other row and label is left as it is.
import { cleanText } from './core-text.js';
import { namesakes } from '../meters/npc-meters-parts/namesakes.js';

const ROW_LISTS = ['npcs', 'profileUpdates', 'profile_updates'];

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
    const held = id ? read.list.find(record => record.id === id) : null;
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
 * → { scanResult (the same object when no row concerns namesakes), skipped: [names of the dropped rows] }. `npcs`: the records as they were before the
 * scan, with their presence; `scene`: the names the reply's scene lists, when known.
 */
export function settleScanRows(npcs, scanResult, scene = []) {
    const read = namesakes(Array.isArray(npcs) ? npcs : []);
    const skipped = new Set();
    let out = scanResult;
    for (const key of ROW_LISTS) {
        const rows = scanResult?.[key];
        if (!Array.isArray(rows)) continue;
        const next = [];
        let changed = false;
        for (const row of rows) {
            const settled = settleRow(read, row, scene);
            changed ||= settled !== row;
            if (settled === null && row !== null) skipped.add(cleanText(row?.name, 120));
            else next.push(settled);
        }
        if (changed) out = { ...out, [key]: next };
    }
    return { scanResult: out, skipped: [...skipped] };
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
