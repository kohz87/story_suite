// Works out what a reply changed (items, coin, place, who is present) from its state, the state before and the touched paths.
import { isRecord } from './shared-record.js';

const INVENTORY = /^\/domains\/inventory(\/|$)/;
const STACK = /^\/domains\/inventory\/stacks\/([^/]+)/;
const WALLETS = /^\/domains\/inventory\/wallets(\/|$)/;
const PLACE = /^\/domains\/scene\/place(\/|$)|^\/domains\/scene$/;
const PRESENT = /^\/domains\/scene\/present(\/|$)|^\/domains\/scene$/;
const LOOT = /^\/domains\/inventory\/loot(?:\/([^/]+))?$/;

const inventoryOf = state => (isRecord(state?.domains?.inventory) ? state.domains.inventory : {});
const sceneOf = state => (isRecord(state?.domains?.scene) ? state.domains.scene : {});
const coinOf = state => {
    const coin = inventoryOf(state).wallets?.party?.coin;
    return Number.isSafeInteger(coin) ? coin : 0;
};
const placeName = state => (typeof sceneOf(state).place?.name === 'string' ? sceneOf(state).place.name : '');
const presentOf = state => (Array.isArray(sceneOf(state).present) ? sceneOf(state).present.filter(name => typeof name === 'string') : []);
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || (a.def < b.def ? -1 : a.def > b.def ? 1 : 0);

// Quantity held per item definition, every owner together (a hand-over between members is no change).
function heldByDef(state) {
    const held = new Map();
    for (const stack of Object.values(inventoryOf(state).stacks ?? {})) {
        if (!isRecord(stack) || typeof stack.def !== 'string' || !Number.isSafeInteger(stack.qty)) continue;
        held.set(stack.def, (held.get(stack.def) ?? 0) + stack.qty);
    }
    return held;
}

function defName(def, ...states) {
    for (const state of states) {
        const name = inventoryOf(state).defs?.[def]?.name;
        if (typeof name === 'string' && name) return name;
    }
    return def;
}

/**
 * What a reply changed, from its state, the state before it (the previous carrier's; null for the
 * greeting or when unknown) and the JSON Pointers its ops touched (the card mount's `changes`).
 * → { gained: [{ def, name, qty }], lost: [{ def, name, qty }], held: [{ def, name, qty }],
 *     coin: number | null, coinNow: number | null, place: string | null, arrived: [], left: [],
 *     presentNow: string[] | null, other: bool }
 * With `before`, gained / lost / coin / arrived / left are differences. Without it, `held` lists the
 * touched items with what is held now, `coinNow` the wallet and `presentNow` who is here, since nothing
 * says what they were before. `other` is true when the reply changed something else (another module's).
 */
export function changesDigest({ state = null, before = null, changes = [] } = {}) {
    const paths = (Array.isArray(changes) ? changes : [...(changes ?? [])]).filter(path => typeof path === 'string');
    const digest = { gained: [], lost: [], held: [], coin: null, coinNow: null, place: null, arrived: [], left: [], presentNow: null, other: false, loot: 0 };
    const touched = test => paths.some(path => test.test(path));
    const known = isRecord(before);

    if (touched(INVENTORY)) {
        if (known) {
            const now = heldByDef(state);
            const then = heldByDef(before);
            for (const def of new Set([...then.keys(), ...now.keys()])) {
                const delta = (now.get(def) ?? 0) - (then.get(def) ?? 0);
                if (delta > 0) digest.gained.push({ def, name: defName(def, state, before), qty: delta });
                else if (delta < 0) digest.lost.push({ def, name: defName(def, state, before), qty: -delta });
            }
            digest.gained.sort(byName);
            digest.lost.sort(byName);
            const coin = coinOf(state) - coinOf(before);
            if (coin !== 0) digest.coin = coin;
        } else {
            const stacks = inventoryOf(state).stacks ?? {};
            const ids = new Set(paths.map(path => STACK.exec(path)?.[1]).filter(id => id && isRecord(stacks[id])));
            const held = new Map();
            for (const id of ids) held.set(stacks[id].def, (held.get(stacks[id].def) ?? 0) + stacks[id].qty);
            digest.held = [...held].map(([def, qty]) => ({ def, name: defName(def, state), qty })).sort(byName);
            if (touched(WALLETS)) digest.coinNow = coinOf(state);
        }
    }
    // Loot laid out by this reply (`? loot`): how many things its offer holds.
    const offers = isRecord(inventoryOf(state).loot) ? inventoryOf(state).loot : {};
    const laid = new Set();
    for (const path of paths) {
        const m = LOOT.exec(path);
        if (!m) continue;
        if (m[1]) laid.add(m[1].replace(/~1/g, '/').replace(/~0/g, '~'));
        else Object.keys(offers).forEach(key => laid.add(key));
    }
    for (const key of laid) if (isRecord(offers[key]?.items)) digest.loot += Object.keys(offers[key].items).length;
    if (touched(PLACE)) {
        const name = placeName(state);
        if (!known || name !== placeName(before)) digest.place = name;
    }
    if (touched(PRESENT)) {
        const now = presentOf(state);
        const then = known ? presentOf(before) : [];
        const lower = list => new Set(list.map(name => name.toLowerCase()));
        const nowKeys = lower(now);
        const thenKeys = lower(then);
        digest.arrived = known ? now.filter(name => !thenKeys.has(name.toLowerCase())) : [];
        digest.left = then.filter(name => !nowKeys.has(name.toLowerCase()));
        if (!known) digest.presentNow = now;
    }
    digest.other = paths.some(path => !INVENTORY.test(path) && !/^\/domains\/scene(\/|$)/.test(path) && !/^\/meta(\/|$)/.test(path));
    return digest;
}
