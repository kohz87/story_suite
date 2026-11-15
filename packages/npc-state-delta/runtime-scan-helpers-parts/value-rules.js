// Small shared predicates and clamps: whether one-pass capture is on, the relationship number clamp and who is worth a slice entry.

import { getSettings } from '../runtime-settings.js';

export function narrationCaptureEnabled(settings = getSettings()) {
    return Boolean(settings.enabled && settings.narrationCapture && !settings.fullScanEveryTurn);
}

export function relationshipNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.max(-100, Math.min(100, number))) : 0;
}

// A person worth a slice entry: not the dead and not incidental extras (the slice holds 80 people; a long chat must not fill it with people who never matter).
export const worth = npc => !['dead', 'deceased'].includes(String(npc.lifeState ?? '').toLowerCase()) && npc.dossierSignal !== 'incidental';
