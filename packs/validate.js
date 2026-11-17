// pack.json validation and normalization (SPEC §9; pure).
//
// validatePack(input, options) → { ok: true, pack, raw } | { ok: false, errors: [{ code, path, message }] }
//
// `input` is the file's text or an already parsed value. The checks run in three rounds,
// each only when the one before passed: size and JSON, plain safe data (safety.js), then
// the fields. `pack` is the normalized form every lookup uses: content records get their
// namespaced ID (`pack.<id>/<slug>`), defaults filled in, item references inside the pack
// written as full IDs. `raw` is a detached copy of what was given, the form kept in settings.
//
// Options: `hostVersion` (Story Block's version, checked against requires.storyBlock) and
// `capabilities` (the capability names this Story Block has, or null when unknown: then
// requires.capabilities is checked for form only).
// `dataModuleDefinitions`: checked normalized dependency definitions for public cross-pack data imports.
// `readableConditions`: false for a pack already stored (installed.js): an event whose `when` cannot be read is then not an error, so
// it stays the one invalid event the events part makes of it (as before 2.11.3) and the rest of the pack keeps working. Install, import
// and the authoring-kit checker leave it true.
//
// Public face: re-exports its parts.

export { validatePack } from './validate-parts/pack.js';
export { HOST_VERSION, SUITE_VERSION, slugify } from './validate/core.js';
export { unsafeCss, checkScreens } from './validate/theme.js';
