/* NPC State Delta dossier screens part: how a screen is written and laid out: its text form, the desktop panes and the refresh signature. */
import { normalizeSection, SECTION_KEYS } from './parse-screen.js';

const DESKTOP_PANES = Object.freeze({
    library: Object.freeze(['library']),
    board: Object.freeze(['dial', 'board']),
    section: Object.freeze(['dial', 'board', 'section']),
    profile: Object.freeze(['portrait', 'profile']),
});

export function formatScreen(screen) {
    return screen.name === 'section' ? `section:${SECTION_KEYS[normalizeSection(screen.section)]}` : screen.name;
}

// Phone: the one screen. Desktop: library alone; board = dial + board; section adds a right pane; profile = portrait + profile.
export function layoutFor(state, { phone = false } = {}) {
    if (phone) return { mode: 'phone', panes: [state.name] };
    return { mode: 'desktop', panes: DESKTOP_PANES[state.name] || DESKTOP_PANES.library };
}

// Goes into the dossier viewToken so a refresh keeps the screen and does not reset it.
export function screenSignature(state) {
    return `${state.npcId || ''}|${formatScreen(state)}`;
}
