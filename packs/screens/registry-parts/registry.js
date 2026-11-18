// The screen registry itself: sources, the reader's choice, which definition a screen uses now.

import { byNavOrder } from './nav-order.js';
import { validateScreen } from './validate.js';
import { isRecord } from './shared-record.js';

// ---------------------------------------------------------------------------------------------------
// The registry

const PIN = /^(module|card|pack)(?::(.+))?$/;

/**
 * @param {object} [options]
 * @param {() => object} [options.reader]          the reader's screen settings: { screens: { [id]: choice }, cards: { [id]: true } }
 * @param {(next: object) => void} [options.saveReader]  stores a changed copy of those settings
 */
export function createScreens({ reader = () => ({}), saveReader = () => {} } = {}) {
    const modules = new Map();     // moduleId → Map(id → def)
    const packs = new Map();       // packId → Map(id → def), in the order first set
    let card = new Map();          // id → def
    let version = 0;

    const readerSettings = () => {
        const value = reader();
        return isRecord(value) ? value : {};
    };
    const choices = () => (isRecord(readerSettings().screens) ? readerSettings().screens : {});
    const writeReader = change => {
        const current = readerSettings();
        const next = { ...current, screens: { ...(isRecord(current.screens) ? current.screens : {}) }, cards: { ...(isRecord(current.cards) ? current.cards : {}) } };
        change(next);
        saveReader(next);
        version++;
    };

    const byId = (list, what) => {
        if (!Array.isArray(list)) throw new TypeError(`${what} screens must be a list.`);
        const map = new Map();
        for (const def of list) {
            const id = isRecord(def) && typeof def.id === 'string' ? def.id : null;
            if (!id) throw new TypeError(`${what} has a screen without an id.`);
            if (map.has(id)) throw new Error(`${what} defines screen "${id}" twice.`);
            map.set(id, def);
        }
        return map;
    };

    function moduleDefault(id) {
        for (const [moduleId, map] of modules) if (map.has(id)) return { source: 'module', origin: moduleId, def: map.get(id) };
        return null;
    }
    function packCandidates(id, only = null) {
        const found = [];
        for (const [packId, map] of packs) if (map.has(id) && (only === null || only === packId)) found.push({ source: 'pack', origin: packId, def: map.get(id) });
        return found.reverse();   // the pack set last first
    }
    const cardCandidate = id => (card.has(id) ? { source: 'card', origin: 'card', def: card.get(id) } : null);

    // Every candidate for `id`, strongest first, with the reader's pin (if any) in front.
    function candidates(id) {
        const normal = [cardCandidate(id), ...packCandidates(id), moduleDefault(id)].filter(Boolean);
        const choice = choices()[id];
        if (choice === undefined || choice === null) return { list: normal, pinned: null };
        if (isRecord(choice) && typeof choice.use === 'string') {
            const match = PIN.exec(choice.use);
            const pick = !match ? [] : match[1] === 'module' ? [moduleDefault(id)].filter(Boolean)
                : match[1] === 'card' ? [cardCandidate(id)].filter(Boolean) : packCandidates(id, match[2] ?? null).slice(0, 1);
            const missing = pick.length ? null : { source: 'reader', origin: choice.use, reason: `The reader chose "${choice.use}" for this screen, but there is no such version.` };
            return { list: [...pick, ...normal.filter(item => !pick.includes(item) && !pick.some(p => p.def === item.def))], pinned: missing };
        }
        return { list: [{ source: 'reader', origin: 'reader', def: choice }, ...normal], pinned: null };
    }

    function resolve(id) {
        const { list, pinned } = candidates(id);
        if (!list.length && !pinned) return null;
        const fallbacks = pinned ? [pinned] : [];
        for (const candidate of list) {
            const errors = validateScreen(candidate.def, { id });
            if (!errors.length) return { id, screen: candidate.def, source: candidate.source, origin: candidate.origin, fallbacks };
            fallbacks.push({ source: candidate.source, origin: candidate.origin, reason: errors.join(' ') });
        }
        return { id, screen: null, source: null, origin: null, fallbacks };
    }

    function ids() {
        const all = new Set([...card.keys()]);
        for (const map of modules.values()) for (const id of map.keys()) all.add(id);
        for (const map of packs.values()) for (const id of map.keys()) all.add(id);
        for (const [id, choice] of Object.entries(choices())) if (isRecord(choice) && choice.use === undefined) all.add(id);
        return [...all].sort();
    }

    return {
        /** Module defaults (registerModule({ screens })). A screen id another module already defines throws. */
        addModule(moduleId, screens) {
            const map = byId(screens, `Module "${moduleId}"`);
            for (const [otherId, other] of modules) {
                if (otherId === moduleId) continue;
                for (const id of map.keys()) if (other.has(id)) throw new Error(`Screen "${id}" is already defined by module "${otherId}".`);
            }
            modules.set(moduleId, map);
            version++;
        },
        removeModule(moduleId) { if (modules.delete(moduleId)) version++; },
        /** A pack's screens (add or override by id); setting the same pack again replaces its list. */
        setPack(packId, screens) { packs.set(packId, byId(screens, `Pack "${packId}"`)); version++; },
        removePack(packId) { if (packs.delete(packId)) version++; },
        /** The current character card's screens. */
        setCard(screens) { card = byId(screens ?? [], 'The card'); version++; },
        clearCard() { card = new Map(); version++; },

        resolve,
        ids,
        /**
         * Usable screens that may appear in `mount`, in navigation order (screenOrder, then id):
         * [{ id, screen, source, origin, fallbacks }].
         */
        list(mount = null) {
            const usable = ids().map(resolve).filter(entry => entry?.screen && (mount === null || entry.screen.mounts.includes(mount)));
            return byNavOrder(usable, entry => entry.id, entry => entry.screen.order);
        },
        /** Every skipped definition and why, for the overlay: [{ id, source, origin, reason }]. */
        problems() {
            return ids().flatMap(id => (resolve(id)?.fallbacks ?? []).map(item => ({ id, ...item })));
        },
        /** Bumped on every change, so mounts can tell a cached render is out of date. */
        version: () => version,

        choice: id => choices()[id] ?? null,
        /**
         * Does the screen say `bar: true` (in the bar by default)? The strongest usable definition that says either way decides, so a
         * pack's or the reader's restyle that leaves the key out keeps what the module declared.
         */
        declaredBar(id) {
            for (const candidate of candidates(id).list) {
                if (typeof candidate.def?.bar !== 'boolean' || validateScreen(candidate.def, { id }).length) continue;
                return candidate.def.bar;
            }
            return false;
        },
        /** The reader's own definition, or a pin { use: 'module' | 'card' | 'pack' | 'pack:<id>' }. */
        choose(id, choice) { writeReader(next => { next.screens[id] = choice; }); },
        /** Back to the module default, whatever the card or packs say. */
        reset(id) { writeReader(next => { next.screens[id] = { use: 'module' }; }); },
        /** Forget the reader's choice: the normal order (card, pack, module) applies again. */
        clearChoice(id) { writeReader(next => { delete next.screens[id]; }); },

        /** Inline cards are off until the reader turns them on, per screen. */
        // The reader's own on/off wins; without one a card screen is on when it says `defaultOn: true`.
        cardsOn(id) {
            const choice = readerSettings().cards?.[id];
            if (choice === true || choice === false) return choice;
            return resolve(id)?.screen?.defaultOn === true;
        },
        setCards(id, on) { writeReader(next => { next.cards[id] = Boolean(on); }); },
    };
}
