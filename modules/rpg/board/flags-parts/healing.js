// Tells whether a skill describes healing.

const HEALING = /\b(?:heal|heals|healing|mend|mends|mending|restore|restores|restoring|recover|recovers|recovering|remedy|remedies|cure|cures|curing|soothe|soothes|soothing|revive|revives|reviving)\b/iu;

/** Whether a skill describes healing, as Auto and the marked board both understand it. */
export const healingSkill = skill => skill?.healing === true || skill?.support === true || skill?.kind === 'heal'
    || HEALING.test(`${skill?.name ?? ''} ${skill?.about ?? ''} ${skill?.describe ?? ''}`);
