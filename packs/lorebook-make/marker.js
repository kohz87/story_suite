// The job: the book a world pack's lore is written to: its name, and the disabled marker entry that says Story Suite made it from which pack and version.
// Pure: no SillyTavern and no module imports (the Studio imports it through convert.js).

export const LOREBOOK_TAG = '[storysuite:lorebook]';
const TAG = /\[\s*storysuite\s*:\s*lorebook\s*\]/i;

/** Is this title (an entry's `comment`) the marker of a book made from a pack? */
export const isLorebookTitle = title => TAG.test(String(title ?? ''));

/**
 * The book's name, "<pack name> (Story Suite)", safe as a file name: SillyTavern stores a book as `<name>.json` through sanitize-filename, so a
 * character that would be dropped there (`/ \ ? < > : * | "` and control characters) is taken out here, and the name SillyTavern lists is this one.
 */
export function lorebookName(packName) {
    const safe = String(packName ?? '').replace(/[\u0000-\u001f\u0080-\u009f/\\?<>:*|"]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 100).trim();
    return `${safe || 'World pack'} (Story Suite)`;
}

/**
 * The marker a book carries, `{ pack, version, format }` (format 1 for a book made before the format was written), or null when it has none (a book Story Suite did not make).
 * `book` is a World Info book as SillyTavern saves it (`{ entries: { "<uid>": entry } }`); the marker's content is JSON.
 */
export function readMarker(book) {
    const entries = book && typeof book === 'object' && book.entries && typeof book.entries === 'object' ? Object.values(book.entries) : [];
    for (const entry of entries) {
        if (!entry || !isLorebookTitle(entry.comment)) continue;
        try {
            const data = JSON.parse(String(entry.content ?? ''));
            if (data && typeof data.pack === 'string' && data.pack) return { pack: data.pack, version: typeof data.version === 'string' ? data.version : '', format: Number.isSafeInteger(data.format) ? data.format : 1 };
        } catch { /* a marker whose text was edited away is no marker */ }
    }
    return null;
}
