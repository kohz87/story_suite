// The chat's Combat rules block and the definition a changed text is saved as.

import { rpgBlocks } from '../party-data.js';

/** The chat's Combat rules block (the first block with the role `rules`): { module, definition, prompt } or null. */
export function combatBlock(state, { roleOf } = {}) {
    const block = rpgBlocks(state, { roleOf }).find(item => item.role === 'rules');
    return block ? { module: block.module, definition: block.definition, prompt: typeof block.definition.prompt === 'string' ? block.definition.prompt : '' } : null;
}

/**
 * The definition a changed text is saved as: the block's own pinned definition with a new `prompt` and nothing else changed
 * (the pin carries an `id` and a `pack` that a definition sent to `dm.redefine` must not have).
 */
export function withPrompt(definition, prompt) {
    const next = structuredClone(definition);
    delete next.id;
    delete next.pack;
    next.prompt = prompt;
    return next;
}
