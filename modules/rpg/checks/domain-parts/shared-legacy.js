// The retired policy field the first checks write drops.

// Story Director 2.1 and earlier kept `policy.rbActors` (links to a retired battle module) in every chat, linked or
// not. Nothing reads it now; a slice may still carry it and the first write of the checks drops it.
export const LEGACY_POLICY = 'rbActors';
