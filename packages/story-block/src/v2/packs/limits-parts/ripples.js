// Field names, tiers and caps of a pack's ripples table.

// A pack's ripples table (read by Story Director's `ripples` part): the powers rival claimants can win over, scoring tiers and caps, and
// the pack's own world directions. Story Block checks its shape; Story Director scores it.
export const RIPPLES_FIELDS = Object.freeze(['powers', 'tiers', 'caps', 'worldDirections', 'standingModule']);
export const RIPPLES_POWER_FIELDS = Object.freeze(['id', 'name', 'aliases', 'factions', 'givers', 'npcs', 'base', 'standing', 'standingBase']);
export const RIPPLES_TIERS = Object.freeze(['small', 'great', 'failed', 'abandoned', 'fight']);
export const RIPPLES_CAPS = Object.freeze(['quest', 'event', 'standing', 'fight', 'power']);
