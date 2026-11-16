/* NPC State Delta record lifecycle: archiving a dossier, what keeps one from retention cleanup and the stale archive/delete pass. */
import { normalizeLifeState } from '../core-identity.js';
import { normalizeRelationshipBaseline, RELATIONSHIP_KEYS } from '../core-relationship.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';
import { portraitHasImage } from '../src/portrait-file.js';
import { normalizeNpcRecord } from './normalize.js';

// P6: a record no longer carries archive fields. "Archived" now only decides the life state and presence: archiving for a death marks the person
// deceased; archiving otherwise just takes them off the scene; un-archiving revives a dead person unless a life state is given. (Only the un-archive call, a death correction, is made now; the archive branch has no caller and stays until a later cleanup.)
export function setNpcArchived(npc, archived, { reason = 'manual', lifeState = null, now = null } = {}) {
    // `now` is the caller's clock (the replay clock while a history is replayed); without it, the real one (live, manual).
    const at = Number.isFinite(now) ? now : Date.now();
    const next = normalizeNpcRecord(npc || {});
    if (archived) {
        next.present = false;
        next.worldActive = false;
        if (reason === 'deceased') {
            next.lifeState = 'deceased';
            next.lifeStateCertainty = 'explicit';
        }
    } else {
        const wasDeceased = next.lifeState === 'deceased';
        if (lifeState !== null) next.lifeState = normalizeLifeState(lifeState);
        else if (wasDeceased) next.lifeState = 'alive';
        if (next.lifeState === 'alive') next.lifeStateCertainty = 'explicit';
    }
    next.updatedAt = at;
    return next;
}

// A dossier that matters is never deleted by the stale pass (no count bound): it holds a portrait image (the main one or
// a form's, in `formIds`), comes from the cast pack, has a relationship meter off the configured starting value, or its id is in
// options.keepIds (Story Director's key people and away list). Stored memories alone do not count.
export function npcMattersForRetention(npc, keepIds = new Set(), formIds = new Set(), baseline = null) {
    const start = normalizeRelationshipBaseline(baseline || {});
    const moved = RELATIONSHIP_KEYS.some(key => Number.isFinite(Number(npc?.relationship?.[key])) && Number(npc.relationship[key]) !== Number(start[key] ?? 0));
    return portraitHasImage(npc?.portrait) || formIds.has(npc?.id) || Boolean(npc?.castFrom && typeof npc.castFrom === 'object') || moved
        || keepIds.has(npc?.id);
}

export function applyStaleNpcLifecycle(state = {}, options = {}) {
    const turn = Math.max(0, Math.round(Number(options.turn ?? state?.turn ?? 0) || 0));
    const archiveAfter = Math.max(1, Math.round(Number(options.archiveAfter) || 30));
    const deleteAfter = Math.max(archiveAfter + 1, Math.round(Number(options.deleteAfter) || 50));
    const protectedIds = new Set((options.protectedIds || []).map(value => String(value || '').trim()).filter(Boolean));
    const keepIds = new Set((options.keepIds || []).map(value => String(value || '').trim()).filter(Boolean));
    const formIds = new Set(Object.entries(state?.formPortraitAssets || {}).filter(([, forms]) => forms && typeof forms === 'object'
        && Object.values(forms).some(portrait => portraitHasImage(portrait))).map(([id]) => String(id)));
    const noDelete = options.noDelete === true; // a hosted read failed: nothing is deleted this round
    const next = { ...state };
    const archived = [];
    const removed = [];
    const removedIds = new Set();
    next.npcs = [];

    for (const raw of (Array.isArray(state?.npcs) ? state.npcs : [])) {
        const npc = normalizeNpcRecord(raw);
        if (isTerminalNpcDeath(npc) || npc.present || npc.worldActive || protectedIds.has(npc.id)) {
            next.npcs.push(npc);
            continue;
        }
        const activityTurn = Math.max(Number(npc.lastSeenTurn || 0), Number(npc.lastWorldActiveTurn || 0));
        const age = Math.max(0, turn - activityTurn);

        // P6: no archive step. A dossier that does not matter and has been quiet for deleteAfter turns is removed (the timing is unchanged);
        // one that matters (portrait, cast, bond off its start, key person) is kept however long it has been quiet.
        const matters = noDelete || npcMattersForRetention(npc, keepIds, formIds, options.baseline);
        if (age >= deleteAfter && !matters) {
            removed.push({ id: npc.id, name: npc.name, age, activityTurn, archiveReason: 'stale' });
            removedIds.add(npc.id);
            continue;
        }
        next.npcs.push(npc);
    }

    if (removedIds.size) {
        if (Array.isArray(state?.pendingBackfills)) {
            next.pendingBackfills = state.pendingBackfills.filter(item => !removedIds.has(String(item?.npcId || '')));
        }
        if (Array.isArray(state?.inlineCards)) {
            next.inlineCards = state.inlineCards.map(entry => ({
                ...entry,
                cards: Array.isArray(entry?.cards) ? entry.cards.filter(card => !removedIds.has(String(card?.id || ''))) : [],
            })).filter(entry => Array.isArray(entry.cards) && entry.cards.length > 0);
        }
        if (state?.portraitAssets && typeof state.portraitAssets === 'object') {
            next.portraitAssets = { ...state.portraitAssets };
            for (const id of removedIds) delete next.portraitAssets[id];
        }
    }

    // Auto lifecycle never suppresses names. A stale NPC can return naturally and receive a new
    // dossier after timed deletion.
    return { state: next, archived, removed };
}
