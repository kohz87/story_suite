// Applies the structured manual add/remove command to the NPC state.
import { normalizeName, cleanText, cleanList } from '../core-text.js';
import { DEFAULT_RELATIONSHIP } from '../core-relationship.js';
import { setNpcArchived, npcMatchesLabel, candidateRecordMatches, createNpcRecord } from '../core-record.js';
import { rosterCount } from '../roster-count.js';

// Structured manual add/remove helper shared by the settings UI. Story text is never parsed here.
export function applyNpcStateCommand(state, command, options = {}) {
    const next = {
        ...(state || {}),
        npcs: Array.isArray(state?.npcs) ? state.npcs.map(n => ({ ...n, aliases: [...(n.aliases || [])] })) : [],
        candidates: Array.isArray(state?.candidates) ? state.candidates.map(c => ({ ...c, aliases: [...(c.aliases || [])] })) : [],
        dismissed: Array.isArray(state?.dismissed) ? [...state.dismissed] : [],
    };
    const action = command?.action === 'remove' ? 'remove' : command?.action === 'add' ? 'add' : '';
    const name = cleanText(command?.name, 120);
    const key = normalizeName(name);
    const report = { action, name, status: 'ignored', npcId: null };
    if (!action || !key) return { state: next, report };

    const excluded = new Set((options.excludeNames || []).map(normalizeName).filter(Boolean));
    const maxNpcs = Math.max(1, Math.min(100, Number(options.maxNpcs) || 40));
    const turn = Number(options.turn ?? state?.turn ?? 0);
    const targetNpcId = cleanText(command?.npcId, 160);
    const existingIndex = targetNpcId
        ? next.npcs.findIndex(npc => String(npc?.id || '') === targetNpcId)
        : next.npcs.findIndex(npc => npcMatchesLabel(npc, name));

    if (action === 'remove') {
        const labels = new Set([key]);
        if (existingIndex >= 0) {
            const npc = next.npcs[existingIndex];
            for (const label of [npc.name, ...(npc.aliases || [])]) {
                const normalized = normalizeName(label);
                if (normalized) labels.add(normalized);
            }
            report.npcId = npc.id;
            report.name = npc.name;
            report.status = 'removed';
            next.npcs.splice(existingIndex, 1);
        } else {
            report.status = 'suppressed';
        }
        next.candidates = next.candidates.filter(candidate => !candidateRecordMatches(candidate, { name, aliases: [] }));
        next.dismissed = [...new Set([...next.dismissed.map(normalizeName).filter(Boolean), ...labels])];
        return { state: next, report };
    }

    if (excluded.has(key)) {
        report.status = 'excluded';
        return { state: next, report };
    }
    next.dismissed = next.dismissed.filter(label => normalizeName(label) !== key);
    const promotedCandidate = next.candidates.find(candidate => candidateRecordMatches(candidate, { name, aliases: [] })) || null;
    next.candidates = next.candidates.filter(candidate => !candidateRecordMatches(candidate, { name, aliases: [] }));
    if (existingIndex >= 0) {
        let npc = next.npcs[existingIndex];
        const wasArchived = Boolean(npc.archived);
        if (wasArchived) {
            npc = setNpcArchived(npc, false);
            next.npcs[existingIndex] = npc;
        }
        if (promotedCandidate) {
            npc.aliases = cleanList([...(npc.aliases || []), promotedCandidate.name, ...(promotedCandidate.aliases || [])], 8, 120)
                .filter(alias => normalizeName(alias) !== normalizeName(npc.name));
            if (!npc.role && promotedCandidate.role) npc.role = promotedCandidate.role;
            if (!npc.location && promotedCandidate.location) npc.location = promotedCandidate.location;
        }
        npc.lastSeenTurn = Math.max(Number(npc.lastSeenTurn || 0), turn);
        npc.updatedAt = Date.now();
        report.npcId = npc.id;
        report.name = npc.name;
        report.status = wasArchived ? 'restored' : 'exists';
        return { state: next, report };
    }
    if (rosterCount(next.npcs, turn, options.archiveAfter) >= maxNpcs) {
        report.status = 'full';
        return { state: next, report };
    }
    const record = createNpcRecord(name, next.npcs.map(n => n.id), options.relationshipBaseline || DEFAULT_RELATIONSHIP);
    if (promotedCandidate) {
        record.aliases = cleanList([promotedCandidate.name, ...(promotedCandidate.aliases || [])], 8, 120)
            .filter(alias => normalizeName(alias) !== normalizeName(record.name));
        record.role = promotedCandidate.role || '';
        record.location = promotedCandidate.location || '';
    }
    record.lastSeenTurn = turn;
    next.npcs.push(record);
    report.npcId = record.id;
    report.name = record.name;
    report.status = 'added';
    return { state: next, report };
}
