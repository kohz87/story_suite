/* NPC State Delta identity: the NPC life states and normalizing a life-state value. */
export const NPC_LIFE_STATES = Object.freeze(['unknown', 'alive', 'deceased']);

export function normalizeLifeState(value) {
    const state = String(value ?? '').trim().toLowerCase();
    return NPC_LIFE_STATES.includes(state) ? state : 'unknown';
}
