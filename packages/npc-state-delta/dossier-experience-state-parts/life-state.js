// The life-state choice of a dossier (alive, deceased or unknown) projected from an NPC record.
import { isTerminalNpcDeath } from '../core.js';
import { plain } from '../dossier-tools-core.js';

export function lifeStateChoice(npc = {}) {
    if (isTerminalNpcDeath(npc)) return 'deceased';
    const value = plain(npc?.lifeState).toLowerCase();
    const certainty = plain(npc?.lifeStateCertainty).toLowerCase();
    // Recover the short-lived Stage 8 UI shape without weakening automatic death rules.
    if (value === 'dead' && (certainty === 'confirmed' || certainty === 'explicit')) return 'deceased';
    if (value === 'deceased' && certainty === 'explicit') return 'deceased';
    if (value === 'alive' || value === 'living') return 'alive';
    return 'unknown';
}


