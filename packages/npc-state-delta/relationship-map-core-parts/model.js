/* The relationship map model: nodes, bond lines and the selected NPC panel built from the dossier projection. */
import { DESKTOP_NODE_CAP, MAP_SPAN } from './span-and-caps.js';
import { lensValue } from './lenses.js';
import { mapAngles, point } from './geometry.js';
import { mapStatus, resolveMapBonds, selectMapNpcs } from './selection.js';
import { plain, score } from './shared-values.js';

const AXES = Object.freeze([['trust', 'Trust'], ['affection', 'Affection'], ['desire', 'Desire'], ['tension', 'Tension']]);

// The gold badge shows only a change recorded on the current turn that moved the current lens.
export function relationshipDelta(change = {}, lens = 'warmth', turn = null) {
    if (!change || change.turn === null || change.turn === undefined || Number(change.turn) !== Number(turn)) return 0;
    const delta = change.delta && typeof change.delta === 'object' ? change.delta : {};
    if (lens === 'warmth') return Math.round((score(delta.trust) + score(delta.affection)) / 2);
    return score(delta[lens]);
}

function shortName(name) {
    const words = plain(name).replace(/^(?:the|capt\.?|captain|sir|lady|lord|sister|brother|old)\s+/i, '').split(/\s+/);
    return words[0] || plain(name);
}

export function buildMapModel(projection = {}, { selectedId = '', lens = 'warmth', allBonds = true, cap = DESKTOP_NODE_CAP } = {}) {
    const npcs = Array.isArray(projection?.npcs) ? projection.npcs.filter(npc => npc?.id) : [];
    const turn = Number.isFinite(Number(projection?.turn)) ? Number(projection.turn) : 0;
    const { shown, total } = selectMapNpcs(npcs, { lens, cap, selectedId });
    const angles = mapAngles(shown);
    const positions = new Map(shown.map(npc => [npc.id, point(lensValue(npc.relationship, lens), angles.get(npc.id))]));
    const selected = shown.find(npc => npc.id === selectedId) || null;
    const nodes = shown.map(npc => {
        const at = positions.get(npc.id);
        const status = mapStatus(npc);
        return {
            id: npc.id,
            name: npc.name,
            short: shortName(npc.name),
            initial: (shortName(npc.name).charAt(0) || '?').toLocaleUpperCase(),
            portrait: plain(npc.portrait),
            status,
            value: lensValue(npc.relationship, lens),
            delta: relationshipDelta(npc.lastRelationshipChange, lens, turn),
            selected: npc.id === selectedId,
            x: (at.x / MAP_SPAN) * 100,
            y: (at.y / MAP_SPAN) * 100,
        };
    });
    const lines = resolveMapBonds(npcs, new Set(positions.keys()))
        .map(bond => ({ ...bond, touches: bond.a === selectedId || bond.b === selectedId }))
        .filter(bond => bond.touches || allBonds)
        .map(bond => ({ touches: bond.touches, a: bond.a, b: bond.b, relation: bond.relation, dynamic: bond.dynamic, tags: bond.tags, tagsBy: bond.tagsBy, from: positions.get(bond.a), to: positions.get(bond.b) }));
    const change = selected?.lastRelationshipChange || {};
    return {
        turn,
        reply: Number.isInteger(projection?.reply) && projection.reply >= 0 ? projection.reply : -1,
        lens,
        nodes,
        lines,
        shownCount: shown.length,
        total,
        allZero: shown.length > 0 && nodes.every(node => node.value === 0),
        selected: selected ? {
            id: selected.id,
            name: selected.name,
            axes: AXES.map(([key, label]) => ({
                key,
                label,
                value: score(selected.relationship?.[key]),
                delta: change.turn !== null && Number(change.turn) === turn ? score(change.delta?.[key]) : 0,
                on: lens === key || (lens === 'warmth' && (key === 'trust' || key === 'affection')),
            })),
            // The dossier projection's label: "Reply #N" (1.2.3), or "Turn N" for an older record.
            lastWhen: plain(change.when),
            lastReason: plain(change.reason),
        } : null,
    };
}
