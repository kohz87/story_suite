// The chat frame, read from the installed packs: what a chat begins with (the selected world and game, their versions and hashes, the game's calendar
// and currency) and the one note that says a pack changed since. Reads the packs and writes nothing.

import { hashJson } from '../../replay.js';

// A pack's hash is made once per checked pack object (the checker's result is kept, so a reply does not hash a 0.6 MB pack again).
const hashes = new WeakMap();
function hashOf(pack) {
    if (!hashes.has(pack)) {
        let hash = '';
        try { hash = hashJson(pack); } catch { hash = ''; }
        hashes.set(pack, hash);
    }
    return hashes.get(pack);
}

const entryOf = pack => ({ pack: pack.id, version: String(pack.version ?? ''), hash: hashOf(pack) });
const copy = value => (value ? structuredClone(value) : null);

function selectedPacks(packs) {
    const picked = packs.selected();
    const list = packs.packs();
    const find = (kind, id) => (id ? list.find(pack => pack.kind === kind && pack.id === id) ?? null : null);
    return { world: find('world', picked.world), game: find('game', picked.game) };
}

/**
 * The frame a chat would begin with now: `{ world, game, calendar, currency }`, or null when no world and no game is selected (a chat of format 3 packs
 * or of none has no frame). `always` gives one anyway (the built-in game, no world) for "Use the current game in this chat". `packs`: the installed list
 * (`packs/installed.js`). The calendar and currency are the game pack's own; a built-in game has none here, and the time and money modules use their own.
 */
export function resolveFrame(packs, { always = false } = {}) {
    const { world, game } = selectedPacks(packs);
    if (!world && !game && !always) return null;
    return { world: world ? entryOf(world) : null, game: game ? entryOf(game) : 'built-in', calendar: copy(game?.calendar), currency: copy(game?.currency) };
}

const major = version => Number.parseInt(String(version).split('.')[0], 10);

/**
 * `{ key, message }` when the selected world or game has the id of one in `frame` but not its hash, else null. `key` names what changed, so the note is
 * given once; the message adds "Start a new chat to be safe." when the major version differs.
 */
export function updateNote(frame, packs) {
    if (frame?.set !== true) return null;
    const now = selectedPacks(packs);
    const parts = [];
    for (const kind of ['world', 'game']) {
        const was = frame[kind];
        const pack = now[kind];
        if (!was || typeof was !== 'object' || !pack || pack.id !== was.pack || !was.hash) continue;
        const hash = hashOf(pack);
        if (!hash || hash === was.hash) continue;
        parts.push({ key: `${kind}:${pack.id}:${hash}`, name: pack.name || pack.id, was: was.version, now: String(pack.version ?? ''), jump: major(was.version) !== major(pack.version) });
    }
    if (!parts.length) return null;
    const lines = parts.map(part => `${part.name} changed since this chat began (${part.was === part.now ? `${part.was}, edited` : `${part.was} → ${part.now}`}).`);
    if (parts.some(part => part.jump)) lines.push('Start a new chat to be safe.');
    return { key: parts.map(part => part.key).join(' '), message: lines.join(' ') };
}
