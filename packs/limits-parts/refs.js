// Patterns for references to defs and screen ids.

// A reference to a def outside the pack: `story/rope`, `pack.fantasy/iron-sword`.
export const DEF_ID = /^(?:story|pack\.[a-z0-9]+(?:-[a-z0-9]+)*)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A screen id: a module's (`example-module/party`) to override, or the pack's own.
export const SCREEN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
