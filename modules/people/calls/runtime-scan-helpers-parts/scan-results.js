// What a committed scan changed, read from the people before and after: relationship moves, refused looks and roles, scan mood numbers.

import { normalizeName, normalizeRelationshipBaseline, npcMatchesLabel } from '../core.js';
import { rejectedOverallLook } from '../appearance-update.js';
import { physicalTraitSwaps } from '../appearance-physical.js';
import { moodNumbers } from '../npc-mood.js';

// What a committed scan tells the slice, read from the people before and after it (moved from runtime-hosted.js, bodies unchanged).
// Each person's relationship moves since the scan began, as npc.adjust payloads; the tier the scanner gave the scan's newest event rides along
// (one event however many meters it moved); none known: sent without one, and not counted. (rule NSDFOLLOW-3) So does the reason the scan recorded for it.
// `onePassRows` (a one-pass block's own rows, else null): each person's relationshipEvidence for the axes the row moved rides along as `why`, also with no move of its own
// (the slice uses it only as the reason of the same reply's story line that gave none; the sidecar drops a one-pass delta, which carries no relationshipChangeReason).
export function relationshipChanges(prior, after, baseline, messageId, onePassRows = null) {
    const changes = [];
    for (const npc of after || []) {
        if (!npc?.id || npc.archived) continue;
        const from = prior.has(npc.id) ? normalizeRelationshipBaseline(prior.get(npc.id).relationship) : baseline;
        const to = normalizeRelationshipBaseline(npc.relationship);
        const meters = Object.fromEntries(Object.keys(to).filter(key => to[key] !== from[key]).map(key => [key, to[key] - from[key]]));
        const last = npc.lastRelationshipChange;
        const fresh = last && JSON.stringify(last) !== JSON.stringify(prior.get(npc.id)?.lastRelationshipChange);
        const why = onePassRows ? onePassEvidence(onePassRows, npc) : null;
        const reason = fresh ? String(last.reason ?? '').trim() : '';
        if (Object.keys(meters).length || why) changes.push({ name: npc.name, meters, start: from, reply: messageId, ...(fresh && typeof last.impact === 'string' ? { impact: last.impact } : {}), ...(reason ? { reason } : {}), ...(why ? { why } : {}) });
    }
    return changes;
}

// A one-pass row's evidence for each axis it moved (non-zero delta, non-empty words): { trust: 'words' }, or null.
function onePassEvidence(rows, npc) {
    const row = (Array.isArray(rows) ? rows : []).find(item => item && ((item.id && item.id === npc.id) || (item.name && npcMatchesLabel(npc, item.name))));
    const delta = row?.relationshipDelta ?? row?.relationship_delta;
    const words = row?.relationshipEvidence ?? row?.relationship_evidence;
    if (!delta || typeof delta !== 'object' || !words || typeof words !== 'object') return null;
    const why = Object.fromEntries(['trust', 'affection', 'desire', 'tension'].filter(axis => Number(delta[axis]) && typeof words[axis] === 'string' && words[axis].trim()).map(axis => [axis, words[axis].trim().slice(0, 240)]));
    return Object.keys(why).length ? why : null;
}

// (card traits win) Report refused looks and roles from both row channels, using the same id/name
// matching as the merge. A look is reported once per NPC even when the row repeats it in two slots.
export function refusedLooks(prior, after, updates = [], rows = []) {
    const refused = [];
    const afterBy = new Map((after || []).map(npc => [npc?.id, npc]));
    const matching = row => prior.get(row?.id) || [...prior.values()].find(npc =>
        (row?.name && npcMatchesLabel(npc, row.name)) || (Array.isArray(row?.aliases) && row.aliases.some(alias => npcMatchesLabel(npc, alias))));
    const allRows = [...(Array.isArray(updates) ? updates : []), ...(Array.isArray(rows) ? rows : [])];
    for (const row of allRows) {
        const was = matching(row);
        const now = afterBy.get(was?.id);
        if (!was || !now || now.archived) continue;
        const candidates = [[was.overallAppearance, now.overallAppearance, row?.overallAppearance ?? row?.overall_appearance, true],
            [was.appearance, now.appearance, row?.appearance, false]];
        const forms = row?.appearanceForms ?? row?.appearance_forms;
        for (const form of Array.isArray(forms) ? forms : []) {
            const key = normalizeName(form?.name);
            const beforeForm = (was.appearanceForms || []).find(item => normalizeName(item.name) === key);
            const afterForm = (now.appearanceForms || []).find(item => normalizeName(item.name) === key);
            if (beforeForm && afterForm) candidates.push([beforeForm.appearance, afterForm.appearance, form.appearance, false]);
        }
        for (const [before, current, incoming, overall] of candidates) {
            if (!before || !incoming) continue;
            const stillRefused = physicalTraitSwaps(current, incoming).filter(swap => physicalTraitSwaps(before, incoming).some(old => old.trait === swap.trait));
            const rejected = overall ? rejectedOverallLook(before, current, { overallAppearance: incoming }) : null;
            if (!stillRefused.length && !rejected) continue;
            if (!refused.some(item => item.id === now.id)) refused.push({ id: now.id, name: now.name, before, incoming, ...(stillRefused.length ? { swaps: stillRefused } : {}) });
        }
    }
    const roles = new Set();
    for (const row of allRows) {
        const was = matching(row);
        const now = afterBy.get(was?.id);
        const held = String(was?.role ?? '').trim();
        const said = typeof row?.role === 'string' ? row.role.replace(/\s+/g, ' ').trim() : '';
        if (!now || now.archived || roles.has(now.id) || (Array.isArray(was?.manualProfileFields) && was.manualProfileFields.includes('role')) || !held || !said || normalizeName(said) === normalizeName(held) || normalizeName(now.role) !== normalizeName(held)) continue;
        roles.add(now.id);
        refused.push({ id: now.id, name: now.name, text: `Role change refused: the story called ${now.name} "${said.slice(0, 60)}"; the record keeps "${held.slice(0, 60)}".` });
    }
    return refused;
}

// The three mood numbers the scan gave with a person's mood word (its row's moodV / moodA / moodD, only with a mood text), or null.
export function scanMoodNumbers(rows, npc, moodOf) {
    const row = (Array.isArray(rows) ? rows : []).find(item => item && ((item.id && item.id === npc.id) || (item.name && npcMatchesLabel(npc, item.name))));
    return moodOf(row) ? moodNumbers(row) : null;
}
