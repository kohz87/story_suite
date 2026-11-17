// Test helper: NPC State Delta's own static prompt part, written the way its runtime injection writes it
// (packages/npc-state-delta/runtime-injection.js updateInjection): the lines builder's rules (core-prompts-lines.js) under
// the production key through ctx.setExtensionPrompt, sent only while NSD is enabled and one-pass capture is on, and
// emptied otherwise. The page's controller needs a full browser mock, so this mirrors its one static write.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const NSD_STATIC_KEY = 'story_suite_static_npc_state_delta';

/** A `loaded` suite whose NPC State Delta adapter reports `isEnabled()` from the returned `state.enabled`, and the impact-tier caps from `state.caps` (null: the host gives none). */
export function withNsdSwitch(loaded) {
    const state = { enabled: true, caps: null };
    const NSD = { ...loaded.NSD, createStorySuiteV2Adapter: options => loaded.NSD.createStorySuiteV2Adapter({ ...options, delta: () => ({ isEnabled: () => state.enabled, getNpc: () => null, relationshipCaps: () => state.caps }) }) };
    return { suite: { ...loaded, NSD }, state };
}

/** Returns update(host, { enabled, onePass }): writes (or empties) NSD's static key on the host's context. */
export async function nsdStaticWriter(loaded) {
    const lines = await import(pathToFileURL(path.join(loaded.roots.nsd, 'core-prompts-lines.js')).href);
    // The runtime sends the lines builder's rules (N7); no setting changes them.
    const rules = lines.buildLinesParts({ layeredSecrets: true }).rules;
    return (host, { enabled, onePass }) => {
        const ctx = host.ctx;
        ctx.setExtensionPrompt(NSD_STATIC_KEY, enabled && onePass ? rules : '', ctx.extension_prompt_types.IN_PROMPT, 0, false, ctx.extension_prompt_roles.SYSTEM);
    };
}
