// The job: reading the open character's lorebook entries (linked world, or the card's embedded copy) as plain objects.

import { entryText, isPackTitle, isPortraitsTitle, isSettingsTitle } from '../lorebook.js';
import { compareVersions, parseVersion } from '../version.js';
import { context } from './shared-context.js';

/**
 * The open character's lorebook entries as plain objects:
 * `{ character, card, entries: [{ book, uid, title, keys, content }], problem }` (`problem` is '' or why
 * nothing could be read, in plain words).
 */
export async function readCharacterLorebook() {
    const ctx = context();
    if (!ctx) return { character: '', entries: [], problem: 'SillyTavern is not available.' };
    const character = ctx.characters?.[ctx.characterId];
    if (!character) return { character: '', entries: [], problem: 'Open a chat with a character first (group chats have no single card).' };
    const name = String(character.name ?? '');
    // Which card this is, for what is remembered about it (the card's own file name, else its name).
    const card = String(character.avatar || name);
    const linked = character.data?.extensions?.world;
    const book = character.data?.character_book;
    const embedded = book && Array.isArray(book.entries)
        ? book.entries.map((entry, index) => ({
            book: String(book.name || name),
            uid: entry?.id ?? index,
            title: String(entry?.comment || entry?.name || ''),
            keys: Array.isArray(entry?.keys) ? entry.keys.map(String) : [],
            content: String(entry?.content ?? ''),
        }))
        : null;
    if (linked && typeof ctx.loadWorldInfo === 'function') {
        let data = null;
        try {
            data = await ctx.loadWorldInfo(linked);
        } catch {
            data = null;
        }
        const entries = data ? Object.values(data.entries ?? {}).map(entry => ({
            book: linked,
            uid: entry?.uid ?? '',
            title: String(entry?.comment ?? ''),
            keys: Array.isArray(entry?.key) ? entry.key.map(String) : [],
            content: String(entry?.content ?? ''),
        })) : [];
        // A linked world that is stale, missing (SillyTavern may answer an empty one) or never imported from the card leaves the card's own
        // embedded copy unread: its [storysuite:…] entries are added for each tag the linked world lacks. The linked world still comes first
        // and everything else (market lines, the rest of the lorebook) is read from it exactly as before.
        const merged = embedded ? mergeStorysuite(entries, embedded) : { entries, extra: [] };
        // A linked world that cannot be loaded is still told as before (the market lines and the Packs panel say so); the card's own embedded
        // storysuite entries are offered all the same.
        return { character: name, card, entries: [...merged.entries, ...merged.extra], problem: data ? '' : `The lorebook "${linked}" could not be loaded.` };
    }
    if (embedded) return { character: name, card, entries: embedded, problem: '' };
    return { character: name, entries: [], problem: `${name || 'This character'} has no lorebook.` };
}

const TAGS = [isPackTitle, isPortraitsTitle, isSettingsTitle];
const packIdentity = entry => {
    try {
        const pack = JSON.parse(entryText(entry.content));
        return typeof pack?.id === 'string' ? { id: pack.id, version: parseVersion(pack.version) } : null;
    } catch { return null; }
};

/**
 * The linked world's entries and the embedded book's storysuite entries put together: `{ entries, extra }` (`entries`: the linked world's, a pack entry
 * left out where the embedded copy of the same pack id is a higher version; `extra`: the embedded storysuite entries to add after them).
 * Pack entries are matched by pack id and the higher version wins (a stale linked world never hides a card update; equal keeps the linked one);
 * the portraits and settings entries come from the embedded book only for a tag the linked world lacks.
 */
function mergeStorysuite(linkedEntries, embedded) {
    const linkedPacks = new Map();
    for (const entry of linkedEntries) if (isPackTitle(entry.title)) { const who = packIdentity(entry); if (who) linkedPacks.set(who.id, { entry, version: who.version }); }
    const dropped = new Set();
    const extra = [];
    for (const entry of embedded) {
        if (isPackTitle(entry.title)) {
            const who = packIdentity(entry);
            const there = who ? linkedPacks.get(who.id) : null;
            if (!there) { if (!who && linkedEntries.some(other => isPackTitle(other.title))) continue; extra.push(entry); continue; }
            if (who.version && there.version && compareVersions(who.version, there.version) > 0) { dropped.add(there.entry); extra.push(entry); }
            continue;
        }
        if (TAGS.some(test => test(entry.title) && !linkedEntries.some(other => test(other.title)))) extra.push(entry);
    }
    // An embedded pack that won (a newer card over a stale linked world) brings its own portraits and settings: the linked ones belong to the older
    // version (portraits are for one pack version), so they give way to the embedded ones where the embedded book has some.
    if (dropped.size) {
        for (const test of [isPortraitsTitle, isSettingsTitle]) {
            const own = embedded.filter(entry => test(entry.title));
            if (!own.length) continue;
            for (const entry of linkedEntries) if (test(entry.title)) dropped.add(entry);
            for (const entry of own) if (!extra.includes(entry)) extra.push(entry);
        }
    }
    return { entries: linkedEntries.filter(entry => !dropped.has(entry)), extra };
}
