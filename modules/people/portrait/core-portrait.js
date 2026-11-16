/* NPC State Delta portrait prompt building: portrait style limits, prompt-format normalization and
   buildNpcPortraitPrompts. Visual-anchor extraction and appearance splitting live in
   core-portrait-visuals.js; natural-language prose lives in core-portrait-prose.js. A pure part of
   core-mechanics.js (same owner); core-mechanics.js re-exports every name it exported before.
   Public face: re-exports its parts. */
export { DEFAULT_PORTRAIT_STYLE_POSITIVE, DEFAULT_PORTRAIT_STYLE_NEGATIVE, DEFAULT_PORTRAIT_COMPOSITION } from './core-portrait-parts/style-defaults.js';
export { PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT, PORTRAIT_NPC_PROMPT_LIMIT, PORTRAIT_PROMPT_FORMATS } from './core-portrait-parts/limits-formats.js';
export { normalizePortraitPromptFormat, buildNpcPortraitPrompts } from './core-portrait-parts/prompts.js';
