// The Focus model: the "Focus: Name ✕" chip and which nodes and bonds stay lit for the focused person.

import { plain, resolveMapBonds } from '../relationship-map-core.js';
import { escapeHtml } from '../src/util/html.js';
import { FOCUS_STATES } from './focus-constants.js';
import { relationWord, tagWord, bondToneOf } from './bond-words.js';

// The "Focus: Name ✕" chip. Name and id are escaped; the ✕ button carries data-map-focus-clear.
export function focusChip(npcId = '', name = '') {
    const id = plain(npcId);
    if (!id) return null;
    const shown = plain(name) || id;
    const label = `Focus: ${shown}`;
    const clearLabel = `Stop focusing on ${shown}`;
    return {
        npcId: id,
        label,
        clearLabel,
        html: `<span class="delta-map-focus-chip" data-map-focus-id="${escapeHtml(id)}">${escapeHtml(label)}`
            + ` <button type="button" class="delta-map-focus-clear ss-tap-pill" data-map-focus-clear="${escapeHtml(id)}"`
            + ` aria-label="${escapeHtml(clearLabel)}" title="${escapeHtml(clearLabel)}">✕</button></span>`,
    };
}

// The focus model for the map as drawn. `map` is buildMapModel's result (its nodes are the shown people);
// `projection` is the same projection the map was built from, so bonds resolve the same way.
// Every shown node gets a state: focus (the person), tied (has a bond with them), dim (everyone else),
// or plain when no focus is active. Bonds listed are only those touching the focused person.
export function buildFocusModel(projection = {}, map = {}, focusId = '', { bondTone } = {}) {
    const id = plain(focusId);
    const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
    const focus = nodes.find(node => node.id === id) || null;
    const states = Object.fromEntries(nodes.map(node => [node.id, FOCUS_STATES.plain]));
    if (!focus) return { active: false, focusId: '', name: '', states, litIds: [], bonds: [], ties: [], chip: null };

    const npcs = Array.isArray(projection?.npcs) ? projection.npcs.filter(npc => npc?.id) : [];
    const names = new Map(nodes.map(node => [node.id, plain(node.name)]));
    const bonds = resolveMapBonds(npcs, new Set(names.keys())).filter(bond => bond.a === id || bond.b === id);
    const ties = bonds.map(bond => {
        const other = bond.a === id ? bond.b : bond.a;
        // The focused person's own wording wins; the other side's wording is the fallback.
        const relation = plain(bond.relation?.[id]) || plain(bond.relation?.[other]);
        // The focused person's own tie tag names the tie ("ally", "rival", "owes"), as in the Ties section; else the relation's family word.
        const word = tagWord(bond.tagsBy?.[id]) || relationWord(relation);
        const dynamic = plain(bond.dynamic?.[id]) || plain(bond.dynamic?.[other]);
        return { id: other, name: names.get(other) || '', relation, dynamic, word, tone: bondToneOf(word, relation, { bondTone, tags: bond.tagsBy?.[id] || bond.tags }) };
    }).sort((a, b) => a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));

    const litIds = [id, ...ties.map(tie => tie.id)];
    const lit = new Set(litIds);
    for (const node of nodes) {
        if (node.id === id) states[node.id] = FOCUS_STATES.focus;
        else states[node.id] = lit.has(node.id) ? FOCUS_STATES.tied : FOCUS_STATES.dim;
    }
    return {
        active: true,
        focusId: id,
        name: plain(focus.name),
        states,
        litIds,
        bonds: bonds.map(bond => ({ a: bond.a, b: bond.b })),
        ties,
        chip: focusChip(id, focus.name),
    };
}
