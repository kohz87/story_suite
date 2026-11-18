// Story Director v2, part screens: the thread kinds that stay behind the scenes, with their headings.

/** The thread kinds behind the scenes, in the order the screen shows them, with their headings. */
export const BEHIND_KINDS = Object.freeze([['agenda', 'Off-screen'], ['clock', 'Clocks'], ['beat', 'Beats'], ['secret', 'Secrets']]);
export const BEHIND = new Set(BEHIND_KINDS.map(([kind]) => kind));
