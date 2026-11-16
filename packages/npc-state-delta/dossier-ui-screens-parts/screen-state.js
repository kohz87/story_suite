/* NPC State Delta dossier screens part: the screen state: create it, show a screen, open an NPC or a section. */
import { frameOf, HISTORY_LIMIT, resolve, sameFrame } from './shared-frames.js';

export function createScreenState({ npcId = null, screen = 'library' } = {}) {
    return { ...resolve(screen, npcId), history: [] };
}

// Moves to another screen and pushes the current one, so Back returns to it. Showing the screen already shown changes nothing.
export function showScreen(state, target, npcId = state.npcId) {
    const next = resolve(target, npcId);
    const current = frameOf(state);
    if (sameFrame(current, next)) return state;
    return { ...next, history: [...state.history, current].slice(-HISTORY_LIMIT) };
}

export function openNpc(state, npcId) {
    return showScreen(state, 'board', npcId);
}

export function openSection(state, index) {
    return showScreen(state, { name: 'section', section: index });
}
