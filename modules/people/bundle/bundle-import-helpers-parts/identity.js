// Imported-dossier identity: name keys, identity matching and fresh import ids.
import { normalizeName } from '../core.js';

export function npcKeys(npc) {
    return [...new Set([npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])]
        .map(normalizeName)
        .filter(Boolean))];
}

export function identityMatchIndex(records, npc, { stableIdOnly = false } = {}) {
    const available = records.map((candidate, index) => ({ candidate, index }));
    const incomingKeys = new Set(npcKeys(npc));
    const incomingName = normalizeName(npc?.name);
    const sameId = npc?.id
        ? available.find(entry => String(entry.candidate?.id || '') === String(npc.id))
        : null;
    if (sameId) {
        const candidateKeys = npcKeys(sameId.candidate);
        const labelsAgree = candidateKeys.some(key => incomingKeys.has(key));
        if (labelsAgree || !incomingKeys.size || !candidateKeys.length) return sameId.index;
        // Same stable id with wholly disjoint identity labels is treated as an id collision,
        // not proof that two unrelated dossiers are the same person.
    }
    // An ID-backed deletion tombstone proves that this imported stable id belongs to an older
    // identity. Never collapse it into a different current homonym merely because the names match.
    if (stableIdOnly && npc?.id) return -1;

    if (incomingName) {
        const canonical = available.filter(entry => normalizeName(entry.candidate?.name) === incomingName);
        if (canonical.length === 1) return canonical[0].index;
        if (canonical.length > 1) return -1;
    }

    const aliasMatches = available.filter(entry => npcKeys(entry.candidate).some(key => incomingKeys.has(key)));
    return aliasMatches.length === 1 ? aliasMatches[0].index : -1;
}

export function uniqueImportedId(npc, usedIds) {
    const stem = normalizeName(npc?.name || 'npc')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'npc';
    let counter = 1;
    let id = `npc_import_${stem}`;
    while (usedIds.has(id)) {
        counter += 1;
        id = `npc_import_${stem}_${counter}`;
    }
    return id.slice(0, 100);
}
