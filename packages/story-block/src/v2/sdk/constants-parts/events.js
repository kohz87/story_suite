// The sdk's event names: the events a module can listen to.

// `feature` ({ id, on, prompt }) fires when the reader turns a feature on or off (MODULES §F100).
// `modules` ({ changes: [{ id, status, reason, from }] }) fires when a module becomes ready, dormant or
// restore-pending (docs/v2/LIFECYCLE.md); `from` is the status it had been announced with, null when new.
export const EVENTS = Object.freeze(['committed', 'head', 'turn', 'feature', 'modules']);
