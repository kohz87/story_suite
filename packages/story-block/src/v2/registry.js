// The module registry (docs/v2/SPEC.md §6, §12): every module's definition, checked when it
// registers, and the lookups the rest of the host asks it (who owns a domain, a command, a
// capture kind; the initial state; hooks, tabs, settings, prompt contexts). One writer per
// domain: a second owner for a domain, command, query, capture kind or tab is refused with a
// plain sentence, and nothing of the refused module is kept. Pure: no DOM, no SillyTavern.
//
// Old and new versions meet (SPEC §6): a module may say which Story Block it needs
// (`requires: { storyBlock: '>=2.0.0' }`) and is refused with "needs Story Block ≥ x" when this
// one is older; a field this host does not know (a newer module's) is logged and ignored, never a
// refusal. A domain's initial() that throws when a chat starts costs that domain only.
//
// Features (MODULES §F100, features.js): what a module marks `feature: '<id>'` is left out of the
// lookups while the reader has that feature off: its capture kinds' grammar and its context (contexts),
// its hooks, tabs, screens and widgets; its queries answer null (query); its commands are known but
// refused by the bus (commandFeature); a change line of its kinds is told quietly (capture().off).
// `featureValue(id)` gives the reader's stored choice (true, false or undefined for the default).
//
// Lifecycle (docs/v2/LIFECYCLE.md): a module may name the peers it needs
// (`requires: { peers: { 'story-director': '^2' } }`). A module whose peer is missing, of another
// version, turned off or not ready itself, or whose peers need each other, is dormant: it is
// registered and its names stay reserved, but it has no domain set up, no capture, hooks, context or
// cards, its commands are not found and its queries answer null. A module with no peers is always
// ready. A restore barrier (`setRestore('pending')`, driven by the save-point package) holds every
// module but Story Block's own the same way. The status is worked out when asked, so a peer that
// registers or comes back is seen at the next view, action or generation, and nothing registers twice.
// Public face: re-exports its parts.

export { createRegistry } from './registry-parts/create.js';
export { CAPTURE_PREFIX, INIT_PREFIX, HOST_MODULE, RESTORE_STATES, STANDARD_PREFIX, SETTINGS_PLACES, MAX_CAPABILITIES, FIELD_TYPES, jsonProblem, normalizeField, definitionProblems, definitionWarnings } from './registry-checks.js';
