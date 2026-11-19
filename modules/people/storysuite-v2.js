// NPC State's Story Suite adapter (docs/v2/SPEC.md §6 and MODULES.md §D): registers NPC State as a module of the Story Suite host on the page, with
// read-only queries, the Dossiers tab and screen, its settings section and the `npc` domain (meters, stages, unlocked hidden notes per reply).
// The adapter's names, its factory (adapter/create.js) and its start (adapter/start.js) are in focused files under adapter/; this file keeps
// every public name at its old path.
// Public face: re-exports its parts.

export { dossierFields, safeImageUrl, portraitUrl } from './adapter/queries.js';
export { meterBarNode } from './adapter/cast-ui.js';
export { isV2Host } from './adapter/connect.js';
export { MODULE_ID, MODULE_NAME, PRESET_KIND } from './adapter/names-module.js';
export { CAST_TAB_ID, DOSSIERS_TITLE, DOSSIERS_ICON, PAGE_SLOT_CLASS } from './adapter/names-tab.js';
export { CAST_SCREEN_ID, CAST_WIDGET, CAST_SCREEN_ORDER, WORLD_FEATURE } from './adapter/names-screen.js';
export { QUERY_NAMES, COMMAND_NAMES, TICK_TURNS } from './adapter/names-api.js';
export { V2_HOST_EVENT, HOST_RETRY_MS, HOST_RETRY_ATTEMPTS, HOST_ALIVE_MS } from './adapter/names-host.js';
export { SECTION_WATCH_MS, HEAD_SETTLE_MS, HEAD_SETTLE_POLL_MS } from './adapter/names-waits.js';
export { createPeopleAdapter } from './adapter/create.js';
export { startPeopleAdapter } from './adapter/start.js';
export { METERS_CARD_ID } from './meters/npc-meters-screen.js';
// What npc.dossier returns: the dossier's own fields, as the dossier shows them (DOSSIER_FIELDS, from the field registry).
export { DOSSIER_FIELDS } from './fields/registry.js';
