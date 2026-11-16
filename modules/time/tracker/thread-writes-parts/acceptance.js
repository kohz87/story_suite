// Checking that an acceptance proof for a thread is genuine and that the reader accepted.

import { offersChosenIn } from '../tracker.js';
import { copy, failure } from './shared-results.js';

const own = (object, key) => Object.hasOwn(object ?? {}, key);

/**
 * The host proves that the reader wrote a complete sentence; SD still checks its meaning.
 * Only a surviving SD acceptance proof for this thread is accepted. The retained intent
 * matcher handles whole names/aliases; explicit refusal takes precedence over acceptance.
 */
export function neutralAcceptance(thread, proofs, proofId, { cause, caller = null } = {}) {
    if (!Array.isArray(proofs)) return failure('DEPENDENCY_UNAVAILABLE', 'Active story evidence is unavailable.');
    const proof = proofs.find(proof => proof.id === proofId);
    if (!proof || proof.owner !== 'story-director' || proof.kind !== 'acceptance'
        || proof.payload?.thread !== thread?.id) return failure('REFUSED', 'No active acceptance proof names this thread.');
    const payload = proof.payload;
    if (own(payload, 'selection')) {
        if (cause !== 'ui' || caller) return failure('REFUSED', 'This proof requires the reader\'s selected action.');
    } else if (own(payload, 'words')) {
        // toRecord's injected type is an intent-matcher input only, never a stored field.
        const offered = { id: thread.id, key: thread.key, kind: 'hook', status: 'active',
            fields: { ...thread.fields, type: 'quest' }, aliases: thread.aliases ?? [] };
        const tracker = { records: [offered] };
        // Positive idioms negate waiting/hesitation, rather than taking the offer.
        const intent = payload.words.replace(/\bcan['’]?t\s+wait\s+to\b/giu, 'will')
            .replace(/\bwould\s+not\s+hesitate\s+to\b/giu, 'will');
        const declined = offersChosenIn(tracker, intent, 'refuse').includes(thread.key);
        const negated = /\b(?:(?:will\s+not|would\s+not|do\s+not|won['’]?t|don['’]?t|can['’]?t|cannot|never|not)\s+(?:\w+\s+){0,2}(?:accept|take|help|join|do|agree)|accept\s+(?:nothing|neither)|no\s+(?:thanks|deal))\b/iu.test(intent)
            || /\bnot\s+sure\s+(?:(?:that\s+)?(?:i|we)\s+)?(?:can|could|will|should)\s+(?:accept|take|help|join|do|agree)\b/iu.test(intent);
        if (declined || negated || !offersChosenIn(tracker, intent, 'accept').includes(thread.key)) {
            return failure('REFUSED', 'The reader\'s words do not accept this goal.');
        }
    } else return failure('REFUSED', 'Acceptance requires a reader selection or explicit words.');
    return { ok: true, proof: copy(proof) };
}
