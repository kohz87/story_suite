// Text length limits and the id sort shared by the pulse parts.

export const NAME_MAX = 80;
export const TOPIC_MAX = 120;
export const FACTIONS_MAX = 4;

export const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
