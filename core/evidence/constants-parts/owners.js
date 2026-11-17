// Proof evidence constants, owners: who may give each kind of proof, the kinds and the stat names.

/** Who may give each kind of proof (contract §6): the module id that owns it. */
export const OWNERS = Object.freeze({
    visit: 'story-director', acceptance: 'story-director', event: 'story-director',
});
export const KINDS = Object.freeze(Object.keys(OWNERS));
export const STATS = Object.freeze(['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);
