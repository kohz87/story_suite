/* NPC State Delta dossier screens part: the section keys and reading a saved screen name into a screen. */

export const SECTION_KEYS = Object.freeze(['mood', 'now', 'with', 'ties', 'past', 'secrets']);
// Saved screens from the five-section dossier read "section:<n>" with n = 0 Right now (mood and where, which is now Mood), 1 With, 2 Ties, 3 Past, 4 Secrets.
const LEGACY_SECTIONS = Object.freeze([0, 2, 3, 4, 5]);
export const SCREEN_NAMES = Object.freeze(['library', 'board', 'profile', 'section']);

// Sections are 0-based: 0 Mood, 1 Right now, 2 With {{user}} (key "with"), 3 Ties, 4 Past, 5 Secrets.
export function normalizeSection(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= 0 && n < SECTION_KEYS.length ? n : 0;
}

// Parses 'library' | 'board' | 'profile' | 'section:<id>'; a saved 'section:<n>' from the five-section dossier opens the same place as before;
// anything unknown is the library (an unknown section id or number opens the first section).
export function parseScreen(text) {
    const raw = String(text ?? '').trim().toLowerCase();
    const match = /^section:(\w+)$/.exec(raw);
    if (match) {
        const byId = SECTION_KEYS.indexOf(match[1]);
        return { name: 'section', section: byId >= 0 ? byId : (/^\d+$/.test(match[1]) ? (LEGACY_SECTIONS[Number(match[1])] ?? 0) : 0) };
    }
    return { name: SCREEN_NAMES.includes(raw) ? raw : 'library', section: 0 };
}
