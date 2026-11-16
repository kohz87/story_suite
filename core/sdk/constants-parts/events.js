// The sdk's event names: the events a module can listen to.

// `feature` ({ id, on, prompt }) fires when the reader turns a feature on or off (MODULES §F100).
// `modules` ({ changes: [{ id, status, reason, from }] }) fires when a module becomes ready, dormant or
// restore-pending (docs/v2/LIFECYCLE.md); `from` is the status it had been announced with, null when new.
// `changed` ({ keys, index, reason }) fires once per reply or out-of-turn change with the domains touched (never an empty list), `['*']` for everything (any head move; with Assist on, a second one follows the reply) (sdk/changed.js).
export const EVENTS = Object.freeze(['committed', 'head', 'turn', 'feature', 'modules', 'changed']);
