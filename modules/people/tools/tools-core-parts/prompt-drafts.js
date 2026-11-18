/* NPC State Delta supporting tools: the small keyed store of portrait prompt drafts kept while a workflow is closed. */
const PROMPT_DRAFT_LIMIT = 20;

export const promptDrafts = new Map();
export function draftKey(chatKey, npcId) { return `${chatKey}::${npcId}`; }
export function keepPromptDraft(key, draft) {
    promptDrafts.delete(key);
    promptDrafts.set(key, { ...draft, touchedAt: Date.now() });
    while (promptDrafts.size > PROMPT_DRAFT_LIMIT) promptDrafts.delete(promptDrafts.keys().next().value);
}
