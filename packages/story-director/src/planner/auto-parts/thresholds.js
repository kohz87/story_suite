// Auto-planning threshold constants for stall days and open thread counts.

export const DEFAULT_STALL_DAYS = 7;
export const DEFAULT_LOW_THREADS = 3;
// (0.9.19) Replies the story must move on after a plan before "running low" may ask for
// another. Without it a discarded or failed plan would be asked for again after the very next
// reply, each time a long model call; five replies is a scene or two, long enough for the
// reader (or the world) to open something of their own first.
export const LOW_THREADS_REPLIES = 5;
