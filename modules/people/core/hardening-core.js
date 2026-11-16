/* NPC State Delta hardening core: settings-key, ownership-move and lifecycle-key rules. Public face: re-exports its parts. */
export { allSettingsKeys, qualifiedKeysForOwner, destinationKeyForOwnerRename } from './hardening-core-parts/settings-keys.js';
export { applyCanonicalOwnershipMove } from './hardening-core-parts/ownership-move.js';
export { liveLifecycleCandidateKeys, resolveOwnedLifecycleKey, resolveDeletedLifecycleKeyFromPresence } from './hardening-core-parts/lifecycle-keys.js';
export { lifecycleRenameStateIsEmpty } from './hardening-core-parts/rename-state.js';
