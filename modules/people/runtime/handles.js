// The in-process handles that replaced the page globals NPC State used to publish: the public runtime API,
// the present-cast API Story Director's World screen draws with, and whether a Story Block v2 host holds the module.
// Writers: legacy/index.js (deltaApi, suiteApi: the Story Suite api that lists npcs() and npcProfiles()), adapter/cast-ui/page-api.js (castApi), adapter/timeline.js (hosted). Readers import this object.
export const pageHandles = { deltaApi: null, suiteApi: null, castApi: null, hosted: false };
