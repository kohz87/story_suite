/* NPC State Delta terminal lifecycle helpers. */
import { normalizeLifeState } from './core-identity.js';
import { TERMINAL_FROZEN_FIELDS } from './src/fields/registry.js';

export function isTerminalNpcDeath(npc = {}) {
    return normalizeLifeState(npc?.lifeState) === 'deceased'
        && String(npc?.lifeStateCertainty || '').trim().toLowerCase() === 'explicit';
}

export function normalizeTerminalNpc(npc = {}) {
    const next = { ...npc };
    if (isTerminalNpcDeath(next)) {
        next.present = false;
        next.worldActive = false;
    }
    return next;
}

export function protectTerminalNpc(previous = {}, candidate = {}) {
    if (!isTerminalNpcDeath(previous)) return normalizeTerminalNpc(candidate);
    const next = {
        ...candidate,
        lifeState: 'deceased',
        lifeStateCertainty: 'explicit',
        lifeStateReason: previous.lifeStateReason || candidate.lifeStateReason || '',
        present: false,
        worldActive: false,
    };

    // Post-death narration may recover durable facts, but it cannot advance live state or the
    // dead NPC's relationship as though they participated in a later scene.
    for (const field of TERMINAL_FROZEN_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(previous, field)) next[field] = structuredClone(previous[field]);
    }
    return normalizeTerminalNpc(next);
}

export function manualLifeStateRecord(npc = {}, requested = 'unknown', now = Date.now()) {
    const next = structuredClone(npc || {});
    const choice = ['alive', 'unknown', 'deceased'].includes(requested) ? requested : 'unknown';
    if (choice === 'deceased') {
        next.lifeState = 'deceased';
        next.lifeStateCertainty = 'explicit';
        next.lifeStateReason = 'Manually marked deceased by the user in the dossier editor.';
        next.present = false;
        next.worldActive = false;
        return next;
    }

    next.lifeState = choice;
    next.lifeStateCertainty = choice === 'alive' ? 'explicit' : '';
    next.lifeStateReason = choice === 'alive'
        ? 'Manually confirmed alive by the user in the dossier editor.'
        : '';
    return next;
}
