/* NPC State Delta admission: the admission modes, their normalizer and the candidate time-to-live and count limits. */
export const NPC_ADMISSION_MODES = Object.freeze(['conservative', 'balanced', 'manual_only']);

export function normalizeNpcAdmissionMode(value) {
    const mode = String(value ?? '').trim().toLowerCase();
    return NPC_ADMISSION_MODES.includes(mode) ? mode : 'conservative';
}

export const NPC_CANDIDATE_TTL_TURNS = 15;
export const NPC_CANDIDATE_LIMIT = 60;
