// The in-process handles that replaced the page globals NPC State used to publish: the public runtime API,
// the present-cast API Story Director's World screen draws with, and whether a Story Block v2 host holds the module.
// Writers: runtime/runtime-entry.js (deltaApi, suiteApi: the Story Suite api that lists npcs() and npcProfiles()), adapter/cast-ui/page-api.js (castApi), adapter/timeline.js (hosted),
// ui/entry/turn-on.js (openPerson: opens the view's dossier for { id, name }, true when it did; null while the view is not on the page). Readers import this object.
export const pageHandles = { deltaApi: null, suiteApi: null, castApi: null, hosted: false, openPerson: null };
