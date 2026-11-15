/* Scan-row label matching and plain list merging: whether a row names a stored record, and de-duplicated list union. */
import { isInterimNpcLabel, isRoleDescriptionLabel } from '../core-identity.js';
import { normalizeName } from '../core-text.js';
import { identityConflict, partialNamePair, placesOverlap } from '../core-merge-names.js';

// A shared role-description label ("Innkeeper", "the captain") fits many people, so on its own it
// links a scan row to a properly named record only with continuity evidence: sameIndividual, the
// record being present (before this scan reset presence), or an overlapping location/home base. A
// record still named by a role keeps plain label matching so interim-identity promotion and name
// reveals continue to work.
export function scanLabelsMatch(record, incoming, presentIds = new Set()) {
    const incomingLabels = [incoming.name, ...(incoming.aliases || [])].filter(label => normalizeName(label));
    const recordLabels = [record.name, ...(record.aliases || [])].filter(label => normalizeName(label));
    const sharedKeys = new Set(recordLabels.map(normalizeName).filter(key => incomingLabels.some(label => normalizeName(label) === key)));
    if (!sharedKeys.size) return false;
    // A surname or a title-less name alone never joins people with different genders or roles (see partialNamePair).
    if (partialNamePair(record.name, incoming.name) && identityConflict(record, incoming, incoming.sameIndividual === true)) return false;
    if (isInterimNpcLabel(record.name, record.identityKind) || isRoleDescriptionLabel(record.name)) return true;
    // A label counts as a name when either side spells it as one ("Red" beside "red").
    if ([...recordLabels, ...incomingLabels].some(label => sharedKeys.has(normalizeName(label)) && !isRoleDescriptionLabel(label))) return true;
    if (incoming.sameIndividual === true || record.present === true || presentIds.has(record.id)) return true;
    return [record.location, record.homeBase].some(place =>
        [incoming.location, incoming.homeBase].some(other => placesOverlap(place, other)));
}

export function candidateMatches(existing, incoming, presentIds) {
    if (incoming.id && incoming.id === existing.id) return true;
    return scanLabelsMatch(existing, incoming, presentIds);
}

export function mergeLists(oldList, newList, limit = 8) {
    const result = [];
    const seen = new Set();
    for (const item of [...(oldList || []), ...(newList || [])]) {
        const key = normalizeName(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(item);
        if (result.length >= limit) break;
    }
    return result;
}
