/* NPC State Delta dossier screens part: moving through screens: Back, a section dot, section arrows and the Esc order. */
import { normalizeSection, SECTION_KEYS } from './parse-screen.js';
import { resolve } from './shared-frames.js';

// Back pops one screen; with no history it goes to the library.
export function goBack(state) {
    if (state.history.length === 0) return { ...resolve('library', state.npcId), history: [] };
    const previous = state.history[state.history.length - 1];
    return { ...resolve(previous, previous.npcId), history: state.history.slice(0, -1) };
}

// A dot jumps to one section in place (no history), like the arrows.
export function setSection(state, index) {
    if (state.name !== 'section') return state;
    const section = normalizeSection(index);
    return section === state.section ? state : { ...state, section };
}

// Arrows and swipes move between sections in place; they do not add history.
export function stepSection(state, delta) {
    if (state.name !== 'section') return state;
    const section = Math.min(SECTION_KEYS.length - 1, Math.max(0, state.section + Math.sign(delta)));
    return section === state.section ? state : { ...state, section };
}

// Esc order: a blocking overlay (editor, lightbox) takes it first; otherwise go back a screen; the library closes the panel.
export function escapeAction(state, { blocked = false } = {}) {
    if (blocked) return 'none';
    return state.name !== 'library' || state.history.length > 0 ? 'back' : 'close';
}
