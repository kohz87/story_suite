// The kinds of generation a reply is built for, the caps on a module's own prompt, and the generation type's normal form.

export const FOREGROUND = Object.freeze(['normal', 'swipe', 'regenerate', 'continue']);
// A module's `ownPrompt` hook: at most this many parts, each counted up to this many characters.
export const OWN_PROMPT_PARTS = 8;
export const OWN_PROMPT_CHARS = 200000;

export const normalizeType = type => String(type ?? 'normal').trim().toLowerCase() || 'normal';
