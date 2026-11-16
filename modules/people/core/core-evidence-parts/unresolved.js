/* NPC State Delta profile evidence: the evidence of a field that the accepted profile does not yet represent. */
import { mergeRecentProfileEvidence } from './merge.js';
import { durableProfileEvidenceAlreadyRepresented } from './represented.js';

export function unresolvedProfileEvidence(field, accepted, prior = [], incoming = []) {
    return mergeRecentProfileEvidence(prior, incoming, field).filter(item =>
        !durableProfileEvidenceAlreadyRepresented(field, accepted, [item]));
}
export const unresolvedCollectionEvidence = unresolvedProfileEvidence;
