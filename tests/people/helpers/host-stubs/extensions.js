// SillyTavern's scripts/extensions.js as the synthetic host (runtime-smoke.mjs) offers it.
export const extension_settings = globalThis.__npcMock.extensionSettings;
export function getContext() { return globalThis.__npcMock.context; }
