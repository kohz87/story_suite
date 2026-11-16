// The readers over a state: get a public path, list the paths, list the leaves.

import { isObject, fold } from './shared-basics.js';
import { sceneSection } from './scene-section.js';
import { moneySection, itemsSection } from './money-items.js';
import { partySection } from './party.js';
import { blocksSection } from './blocks.js';

/**
 * The readers over a state: `{ get(path), paths(), leaves() }`. `deps`: { ask(state, name, args) → the query's answer or null (a query that is
 * not there or throws is null), rpgOn(), persona() }. Pure: it reads, never writes.
 */
export function createReaders({ ask, rpgOn = () => false, persona = () => '' }) {
    const safeAsk = state => (name, args) => { try { return ask(state, name, args) ?? null; } catch { return null; } };
    const flag = () => { try { return rpgOn() === true; } catch { return false; } };
    const who = () => { try { return String(persona() ?? ''); } catch { return ''; } };
    // The sections that read only the state (and the RPG switch and the persona) are kept per head-state object: a state is frozen and a new head is a
    // new object, so repeated gets on one head reuse them. The scene and money ask queries that depend on settings, so they are read each time.
    const kept = new WeakMap();
    function cached(state, root, signature, build) {
        let sections = kept.get(state);
        if (!sections) kept.set(state, sections = new Map());
        const hit = sections.get(root);
        if (hit && hit.signature === signature) return hit.map;
        const map = build();
        sections.set(root, { signature, map });
        return map;
    }
    function section(state, root) {
        if (!isObject(state) || !isObject(state.domains)) return new Map();
        if (root === 'scene') return sceneSection(safeAsk(state));
        if (root === 'money') return moneySection(safeAsk(state), state);
        if (root === 'items') return cached(state, root, '', () => itemsSection(safeAsk(state), state));
        if (root === 'party') { const on = flag(), name = who(); return on ? cached(state, root, name, () => partySection(state, name)) : new Map(); }
        if (root === 'blocks') { const on = flag(); return cached(state, root, String(on), () => blocksSection(state, on)); }
        return new Map();
    }
    const ROOTS = ['scene', 'money', 'items', 'party', 'blocks'];
    const entries = (state, roots = ROOTS) => {
        const all = new Map();
        for (const root of roots) for (const [key, entry] of section(state, root)) all.set(key, entry);
        return all;
    };
    return {
        get(state, path) {
            if (typeof path !== 'string') return undefined;
            const wanted = fold(path);
            const root = wanted.split('.')[0];
            if (!ROOTS.includes(root)) return undefined;
            return section(state, root).get(wanted)?.value;
        },
        paths(state) {
            return [...entries(state).values()].map(entry => entry.path);
        },
        /** path → value of every leaf (not the groups, not party.me's copies), for the diff. */
        leaves(state) {
            const out = new Map();
            for (const entry of entries(state).values()) if (entry.leaf && !entry.alias) out.set(entry.path, entry.value);
            return out;
        },
    };
}
