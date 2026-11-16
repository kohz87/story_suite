// Story Director: when the arc planner should plan automatically (pure).
// Public face: re-exports its parts.

export { DEFAULT_STALL_DAYS, DEFAULT_LOW_THREADS, LOW_THREADS_REPLIES } from './auto-parts/thresholds.js';
export { arcBeats, openThreads, autoPlanReason } from './auto-parts/reason.js';
