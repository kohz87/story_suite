// Proof evidence constants, limits: the structural caps, the stored proof's key list and the control-character test.

/** The structural caps; the contract names none, so these are the host's (EVIDENCE.md "Caps"). */
export const LIMITS = Object.freeze({
    opaqueBytes: 4096,     // a payload the contract leaves to B3/B6 (normalized JSON, UTF-8 bytes)
    selection: 120,        // code points of an acceptance's `selection`
    words: 240,            // code points of an acceptance's `words`
    parents: 8,            // parents of one proof
    perRoot: 32,           // proofs one command (its root transaction) may give
    ids: 500,              // ids one story.evidence call may ask for
});

export const PROOF_KEYS = ['id', 'source', 'owner', 'kind', 'payload', 'payloadHash', 'parents'];
export const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
