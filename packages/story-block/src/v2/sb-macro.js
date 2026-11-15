// The `{{sb::path}}` macro (docs/v2/PUBLIC-API.md "The macro"): SillyTavern's prompts, regex scripts and status bars read the
// public API's paths through it. `{{sb::path}}` is the value as text; `{{sb::path|fallback}}` is the fallback when the path is
// empty or hidden (the same rule as api.get: a hidden value reads as nothing). A list is a comma list; an object has no text (use a
// leaf path). At most MACRO_MAX characters, line breaks turned into spaces. Read-only: no expressions, no functions.
//
// Registered once, through SillyTavern's own macro API:
//   * SillyTavern 1.19 and later (the macro engine, the default): `context.macros.register('sb', …)`, one macro with the path as its argument;
//     taken out again with `context.macros.registry.unregisterMacro('sb')`.
//   * The old macro engine (a context without `macros`, or with the experimental engine switched off): `context.registerMacro`, which only
//     knows exact names, so one `{{sb::path}}` for each path of LEGACY_PATHS (no fallback, no other path); `context.unregisterMacro`.
// Our own injected prompt text is not touched by this: turn.js writes every `{{` of it with a zero-width space (defuseMacros), so a macro
// in a name the story introduced stays text. The value this macro returns is protected the same way.
// Public face: re-exports its parts.
export { MACRO_NAME, MACRO_MAX, LEGACY_PATHS } from './sb-macro-parts/names.js';
export { macroText } from './sb-macro-parts/text.js';
export { registerSbMacro } from './sb-macro-parts/register.js';
