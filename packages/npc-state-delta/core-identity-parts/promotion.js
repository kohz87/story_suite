/* NPC State Delta identity: relating identity labels and finding the interim record a revealed proper name promotes. */
import { normalizeName, cleanText, cleanList } from '../core-text.js';
import { inferNpcIdentityKind, isInterimNpcLabel } from './kind.js';

export function identityLabelsRelated(a, b) {
    const left = normalizeName(a);
    const right = normalizeName(b);
    if (!left || !right) return false;
    return left === right || (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left)));
}

export function findInterimIdentityPromotionIndex(records, incoming) {
    if (!Array.isArray(records)) return -1;
    const incomingName = cleanText(incoming?.name, 120);
    if (!incomingName || inferNpcIdentityKind(incomingName, incoming?.identityKind) !== 'proper_name') return -1;

    // An explicit sameIndividual:false is authoritative unless the model also supplied the
    // old interim label as an alias. Omitted sameIndividual is NOT treated as a veto: models
    // frequently reveal a proper name while forgetting the continuity flag.
    const incomingAliases = cleanList(incoming?.aliases, 8, 120).map(normalizeName).filter(Boolean);
    const incomingRole = cleanText(incoming?.role, 180);
    const incomingLocation = normalizeName(incoming?.location);
    const matches = [];
    for (let i = 0; i < records.length; i += 1) {
        const record = records[i];
        if (!record || !isInterimNpcLabel(record.name, record.identityKind)) continue;
        const oldLabels = [record.name, ...(record.aliases || [])].map(normalizeName).filter(Boolean);
        const aliasClaim = oldLabels.some(label => incomingAliases.includes(label));
        if (incoming?.sameIndividualProvided && !incoming.sameIndividual && !aliasClaim) continue;

        const roleMatch = incomingRole
            ? identityLabelsRelated(record.role, incomingRole) || identityLabelsRelated(record.name, incomingRole)
            : false;
        const recordLocation = normalizeName(record.location);
        const locationConflict = incomingLocation && recordLocation && incomingLocation !== recordLocation;
        if (locationConflict) continue;
        const locationMatch = Boolean(incomingLocation && recordLocation && incomingLocation === recordLocation);

        // Strong continuity can be established by any one of: explicit old-label alias,
        // unique role continuity, or sameIndividual plus a non-conflicting scene/location.
        // Requiring uniqueness below prevents fusing two generic guards/receptionists.
        const samePersonSignal = Boolean(incoming?.sameIndividual);
        if (!aliasClaim && !roleMatch && !(samePersonSignal && (locationMatch || !incomingRole))) continue;
        matches.push(i);
    }
    return matches.length === 1 ? matches[0] : -1;
}
