// Where NPC State keeps its settings: the `npc-state-delta` bucket of the one Story Suite settings tree.

import { SETTINGS_SCHEMA } from '../../../core/settings/schema.js';

/** The module id NPC State registers with, and so the name of its bucket under `storySuite.modules`. */
export const NPC_BUCKET_ID = 'npc-state-delta';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The NPC State settings object inside `extensionSettings.storySuite.modules['npc-state-delta']`, or null when it is not
 * there yet. With `create`, the missing parts are made (a new `storySuite` gets the current schema marker, so the first
 * load does not set it aside). Never reads the old `npc_state_delta` root key.
 */
export function npcBucket(extensionSettings, { create = false } = {}) {
    if (!isRecord(extensionSettings)) return null;
    if (!create) return extensionSettings.storySuite?.modules?.[NPC_BUCKET_ID] ?? null;
    if (!isRecord(extensionSettings.storySuite)) extensionSettings.storySuite = { schema: SETTINGS_SCHEMA };
    const suite = extensionSettings.storySuite;
    if (!isRecord(suite.modules)) suite.modules = {};
    if (!isRecord(suite.modules[NPC_BUCKET_ID])) suite.modules[NPC_BUCKET_ID] = {};
    return suite.modules[NPC_BUCKET_ID];
}
