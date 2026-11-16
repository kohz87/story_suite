/* Incoming custom fields and Key Relationships of a scan row, merged into the stored record by their own rules. */
import { keyRelationshipSubject, mergeKeyRelationshipUpdates, tiesTracked } from '../core-keyrel.js';
import { mergeCustomFieldValues } from '../core-record-custom-fields.js';

// Configured custom fields only, grounded in the source text; a change needs a reason. Null when
// nothing is accepted.
export function incomingCustomFields(existing, incoming, manualFields, options = {}) {
    if (!incoming.customFields || manualFields.has('customFields')) return null;
    return mergeCustomFieldValues(existing.customFields, incoming.customFields, {
        names: options.customFieldNames,
        reason: incoming.customFieldsReason,
        context: options.developmentContext,
    });
}

// The NPC's Key Relationships after an incoming row: merged by counterpart; unmarked rows add new
// counterparts only.
export function incomingKeyRelationships(existing, incoming, manualFields) {
    // A person who records ties' last mentions (tieSeen) lets a full list make room for a new tie (core-keyrel.js); others drop it as before.
    const tieState = tiesTracked(existing) ? { seen: existing.tieSeen, manual: manualFields.has('keyRelationships') } : null;
    if (manualFields.has('keyRelationships')) {
        return [...(existing.keyRelationships || [])];
    } else if ((existing.keyRelationships || []).length) {
        // Key Relationships are durable social continuity, not a running contact log.
        // Scanner omission is never evidence that another important bond vanished. Even
        // during an evolution, update named counterparts in place and preserve unrelated
        // bonds; estrangement/death should change that counterpart's entry rather than
        // silently deleting everyone the model did not mention this turn.
        if (incoming.keyRelationshipsState === 'evolve'
            && String(incoming.keyRelationshipsReason || '').trim()
            && incoming.keyRelationshipsProvided) {
            return mergeKeyRelationshipUpdates(existing.keyRelationships, incoming.keyRelationships || [], tieState);
        } else if (incoming.keyRelationshipsState === 'update'
            && incoming.keyRelationshipsProvided) {
            // Discovery/clarification is not social evolution. A model that correctly
            // marks an update may omit the audit reason, so the explicit lifecycle state
            // plus grounded entries is sufficient to merge by counterpart.
            return mergeKeyRelationshipUpdates(existing.keyRelationships, incoming.keyRelationships, tieState);
        } else if (incoming.keyRelationshipsProvided && (incoming.keyRelationships || []).length) {
            // Recovery for models that extract an explicit newly revealed tie but omit
            // the lifecycle marker entirely. Only NEW counterparts are admitted here;
            // an unmarked rewrite of an already-known person's dynamic is still rejected.
            const knownSubjects = new Set((existing.keyRelationships || []).map(keyRelationshipSubject).filter(Boolean));
            const newlyEstablished = (incoming.keyRelationships || []).filter(entry => {
                const subject = keyRelationshipSubject(entry);
                return subject && !knownSubjects.has(subject);
            });
            return newlyEstablished.length
                ? mergeKeyRelationshipUpdates(existing.keyRelationships, newlyEstablished, tieState)
                : [...(existing.keyRelationships || [])];
        } else {
            return [...(existing.keyRelationships || [])];
        }
    } else {
        return mergeKeyRelationshipUpdates([], incoming.keyRelationships || []);
    }
}
