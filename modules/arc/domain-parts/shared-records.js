// Shared arc domain constants, record guard, and initial slice state.

export const ARC_ROOM = 20;
export const FEATURE = 'story-director.arc';

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const initialArc = () => ({ arcs: {}, ends: {} });
