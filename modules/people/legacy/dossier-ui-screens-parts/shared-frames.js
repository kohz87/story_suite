/* NPC State Delta dossier screens part: the frame helpers every screen move shares (resolve a target, compare frames, the history cap). */
import { normalizeSection, parseScreen, SCREEN_NAMES } from './parse-screen.js';

export const HISTORY_LIMIT = 24;

// A board, profile or section needs an NPC; without one the state falls back to the library.
export function resolve(target, npcId) {
    const parsed = typeof target === 'string' ? parseScreen(target) : target;
    const wanted = SCREEN_NAMES.includes(parsed?.name) ? parsed.name : 'library';
    const name = wanted !== 'library' && !npcId ? 'library' : wanted;
    return { npcId: npcId || null, name, section: name === 'section' ? normalizeSection(parsed?.section) : 0 };
}

export function frameOf(state) {
    return { npcId: state.npcId, name: state.name, section: state.section };
}

export function sameFrame(a, b) {
    return a.npcId === b.npcId && a.name === b.name && a.section === b.section;
}
