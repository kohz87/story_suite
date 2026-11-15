// Evidence, stored proofs: whether a stored proof is whole and owned, its pin, and the short forms of a block's proof.

import { LIMITS, OWNERS, PROOF_KEYS, isObject } from '../constants.js';
import { exactKeys, payloadCheck } from '../payloads.js';
import { isRecordId, sha256, sourceProblem } from '../../replay.js';

/** '' when `proof` is a whole, closed Proof of an owner that may give its kind, else why not. */
export function proofProblem(proof) {
    if (!isObject(proof) || !exactKeys(proof, PROOF_KEYS)) return 'a proof is { id, source, owner, kind, payload, payloadHash, parents } and nothing else';
    if (!isRecordId(proof.id) || !proof.id.startsWith('pf_')) return 'its id is pf_xxxxxxxx';
    const source = sourceProblem(proof.source);
    if (source) return source;
    if (typeof proof.kind !== 'string' || !Object.hasOwn(OWNERS, proof.kind)) return `"${proof.kind}" is not a kind of proof`;
    if (proof.owner !== OWNERS[proof.kind]) return `${proof.owner} does not own "${proof.kind}" proof`;
    const { problem, json } = payloadCheck(proof.kind, proof.payload);
    if (problem) return problem;
    if (proof.payloadHash !== sha256(json)) return 'its payload hash is not its payload\'s';
    if (!Array.isArray(proof.parents) || proof.parents.length > LIMITS.parents || new Set(proof.parents).size !== proof.parents.length
        || !proof.parents.every(id => isRecordId(id) && id !== proof.id)) return 'its parents are a short list of other proof ids';
    return '';
}

/**
 * The pin of a proof in `meta.proofs`: the SHA-256 of its id, kind, owner and payload hash and each parent's pin as the
 * state holds it (one line each). A proof whose kind or owner was changed, or a parent given again with other bytes (an edit, a
 * Re-read), no longer matches the pin it was committed with, and what was built on it is hidden with it.
 */
export function pinOf(proof, pins) {
    let text = `pin\n${proof.id}\n${proof.kind}\n${proof.owner}\n${proof.payloadHash}`;
    for (const id of proof.parents) text += `\n${id}=${typeof pins?.[id] === 'string' ? pins[id] : ''}`;
    return sha256(text);
}

/** What a block's proof is, for the hashes that say whether a block is the one it was (ids, kinds, owners, payload hashes, parents). */
export const evidenceDigest = evidence => (Array.isArray(evidence) && evidence.length
    ? evidence.map(proof => [proof?.id, proof?.kind, proof?.owner, proof?.payloadHash, proof?.parents ?? null])
    : null);

/** The receipt's short form of the proof a command gave: its id, kind and payload hash (the span holds the bytes). */
export const receiptEvidence = proofs => proofs.map(({ id, kind, payloadHash }) => ({ id, kind, payloadHash }));
