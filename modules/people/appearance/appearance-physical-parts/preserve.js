/* Carrying enduring physical traits through an update that omits them. A part of appearance-physical.js (same owner, moved without change). */
import { CONCEALED_MENTION } from './trait-patterns.js';
import { addressedTraitKeys, physicalTraitKeys, presentationSegments } from './segments.js';
import { physicalPieces } from './pieces.js';
import { describesIdentity, identityPhrase } from './identity.js';
import { DURABLE_PROFILE_LIMITS } from '../../core/core-relationship.js';
import { normalizeName } from '../../core/core-text.js';
import { appearanceText, sameAppearance } from '../appearance-text.js';

export function preserveOmittedPhysicalTraits(previous, next, { alsoPresent = '' } = {}) {
    const incoming = appearanceText(next);
    const prior = appearanceText(previous);
    if (!incoming || !prior || sameAppearance(prior, incoming)) return incoming;
    const incomingNormalized = normalizeName(incoming);
    const presentNormalized = normalizeName(alsoPresent);
    const addressed = new Set(presentationSegments(incoming)
        .filter(segment => !CONCEALED_MENTION.test(segment))
        .flatMap(physicalPieces)
        .flatMap(addressedTraitKeys));
    const kept = presentationSegments(prior).flatMap(physicalPieces).filter(piece => {
        if (physicalTraitKeys(piece).some(key => addressed.has(key))) return false;
        const normalized = normalizeName(piece);
        return normalized && !incomingNormalized.includes(normalized) && !(presentNormalized && presentNormalized.includes(normalized));
    });
    // What the NPC is survives an update that only changes outfit or condition ("Dusted with ash"),
    // unless the update opens with its own description of what she is.
    const identity = identityPhrase(prior);
    const identityKey = normalizeName(identity);
    if (identity && !describesIdentity(incoming) && !incomingNormalized.includes(identityKey)
        && !(presentNormalized && presentNormalized.includes(identityKey))
        && !kept.some(piece => normalizeName(piece) === identityKey)) {
        kept.unshift(identity);
    }
    const limit = DURABLE_PROFILE_LIMITS?.appearance || 800;
    // The incoming presentation is authoritative; if the budget is tight, drop carried traits whole
    // from the end (the identity phrase, first, goes last).
    while (kept.length && `${kept.join(', ')}; ${incoming}`.length > limit) kept.pop();
    return kept.length ? appearanceText(`${kept.join(', ')}; ${incoming}`) : incoming;
}
