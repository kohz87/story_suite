// The job: turning a world pack's lore (`content.lore`) into a SillyTavern World Info book, the shape SillyTavern's own editor saves.
// Pure: no SillyTavern and no module imports (the Studio's export uses it too). Hidden entries are left out: their gate stays with the suite.

import { LOREBOOK_TAG, lorebookName } from './marker.js';

// SillyTavern's new-entry template (public/scripts/world-info.js newWorldInfoEntryTemplate), in its order, for the fields a pack does not set.
const TEMPLATE = Object.freeze({
    key: [], keysecondary: [], comment: '', content: '', constant: false, vectorized: false, selective: true, selectiveLogic: 0, addMemo: false, order: 100,
    position: 0, disable: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false, matchPersonaDescription: false,
    matchCharacterDescription: false, matchCharacterPersonality: false, matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false,
    delayUntilRecursion: 0, probability: 100, useProbability: true, depth: 4, outletName: '', group: '', groupOverride: false, groupWeight: 100,
    scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: '', role: 0, sticky: null, cooldown: null, delay: null,
    triggers: [],
});
// The pack's `logic` words → SillyTavern's world_info_logic numbers (AND_ANY 0, NOT_ALL 1, NOT_ANY 2, AND_ALL 3).
const LOGIC = Object.freeze({ 'and any': 0, 'not all': 1, 'not any': 2, 'and all': 3 });
// Where the entries go: a constant entry before the character's definitions (position 0); a keyed one in the chat at depth 0 as a system line
// (position 4, depth 0), beside the turn's own note, so the older messages never change with the keywords and the model's prompt cache keeps them
// (owner, 20 Nov; the format 3 lorebook put keyed entries at depth 4, which changed a message four back every turn). Neither pulls in other entries
// (recursion off); keys match whole words. LOREBOOK_FORMAT says which placement a book was made with: a book of an older format is offered an Update.
const AT_DEPTH = 4, KEYED_DEPTH = 0;
/** The placement version a book is made with (in its marker); 2 = keyed entries at depth 0. */
export const LOREBOOK_FORMAT = 2;
const UIDS = 999_999;
const PROTECTED = '[protected]';
const words = list => (Array.isArray(list) ? list.map(word => String(word ?? '').trim()).filter(Boolean) : []);

// FNV-1a over the title: a stable uid in 1..999999 (0 is the marker's), so an update of the same pack changes only the entries that changed.
function hashUid(title) {
    let hash = 0x811c9dc5;
    for (const ch of String(title)) {
        hash ^= ch.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return 1 + (hash % UIDS);
}

function loreEntry(record, uid, displayIndex) {
    const title = String(record.title ?? '').trim();
    const secondary = words(record.secondaryKeys);
    const constant = record.constant === true;
    return {
        uid,
        ...structuredClone(TEMPLATE),
        key: words(record.keys),
        keysecondary: secondary,
        // (the lore digest reads a `[protected]` tag in a lorebook title as a pack's `protected: true`)
        comment: record.protected === true ? `${title} ${PROTECTED}` : title,
        content: String(record.text ?? ''),
        constant,
        selective: secondary.length > 0,
        selectiveLogic: LOGIC[record.logic] ?? 0,
        addMemo: true,
        order: Number.isFinite(record.order) ? record.order : TEMPLATE.order,
        position: constant ? 0 : AT_DEPTH,
        depth: KEYED_DEPTH,
        excludeRecursion: true,
        preventRecursion: true,
        matchWholeWords: true,
        displayIndex,
    };
}

function markerEntry(pack, name) {
    const content = JSON.stringify({
        pack: String(pack.id ?? ''),
        version: String(pack.version ?? ''),
        format: LOREBOOK_FORMAT,
        note: `Made by Story Suite from the world pack ${name} ${pack.version ?? ''}. Settings › Packs › Update the lorebook replaces this whole book; edits made here are lost then. This entry is off: it is never sent.`.replace(/\s+\./, '.'),
    }, null, 2);
    return { uid: 0, ...structuredClone(TEMPLATE), comment: `${LOREBOOK_TAG} ${name}`, content, selective: false, addMemo: true, disable: true, displayIndex: 0 };
}

/**
 * A world pack (raw or as the checker keeps it) → `{ name, book, counts: { entries, hidden } }`: `name` is the book's name ("<pack name> (Story Suite)"),
 * `book` the World Info book (`{ entries: { "<uid>": entry } }`) with one entry per lore entry that is not hidden plus the disabled marker (uid 0),
 * `counts.entries` the lore entries in it (the marker not counted) and `counts.hidden` the hidden ones left out. `packName` overrides the pack's name.
 */
export function lorebookFromPack(pack, { packName } = {}) {
    const source = pack && typeof pack === 'object' ? pack : {};
    const shown = String(packName ?? source.name ?? source.id ?? '').trim();
    const lore = Array.isArray(source.content?.lore) ? source.content.lore.filter(record => record && typeof record === 'object') : [];
    const kept = lore.filter(record => record.hidden !== true && String(record.title ?? '').trim() && String(record.text ?? '').trim());
    const entries = { 0: markerEntry(source, shown || 'World pack') };
    kept.forEach((record, index) => {
        let uid = hashUid(String(record.title).trim());
        while (entries[uid]) uid = uid >= UIDS ? 1 : uid + 1;
        entries[uid] = loreEntry(record, uid, index + 1);
    });
    return { name: lorebookName(shown), book: { entries }, counts: { entries: kept.length, hidden: lore.filter(record => record.hidden === true).length } };
}
