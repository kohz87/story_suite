// SillyTavern's script.js as the synthetic host (runtime-smoke.mjs) offers it.
export const extension_prompt_types = { NONE: -1, IN_PROMPT: 0, IN_CHAT: 1, BEFORE_PROMPT: 2 };
export const extension_prompt_roles = { SYSTEM: 0, USER: 1, ASSISTANT: 2 };
export function getRequestHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': 'mock' }; }
export async function saveSettings() { globalThis.__npcMock.saveSettingsCalls += 1; }
