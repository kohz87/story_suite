// The job: the reader's own rank label and starting money and items, kept beside the installed packs (`storySuite.you`, `storySuite.start`).
// They come before the selected game pack's (pack-format-4 D6); blank means the game pack's.

import { GAME_START_LIMITS } from './limits-parts/game-start.js';

// The game pack's own start limits (packs/limits-parts/game-start.js), so what the reader may set is what a game pack may say.
const MAX_ITEMS = GAME_START_LIMITS.items;
const NAME_CHARS = GAME_START_LIMITS.name;
const LABEL_CHARS = 40;
const MAX_QTY = GAME_START_LIMITS.qty;
const MAX_MONEY = GAME_START_LIMITS.money;

const record = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

/** Text lines → start items: "Rope", "Rope x3", one per line; a line with no name is skipped, a quantity is kept to 1-9999. */
export function parseItems(text) {
    const out = [];
    for (const raw of String(text ?? '').split('\n')) {
        const line = raw.trim();
        const match = /^(.*?)(?:\s+x\s*(\d+))?$/i.exec(line);
        const name = (match?.[1] ?? '').trim().slice(0, NAME_CHARS);
        if (!name) continue;
        out.push({ name, qty: Math.min(MAX_QTY, Math.max(1, Number(match[2] ?? 1) || 1)) });
        if (out.length >= MAX_ITEMS) break;
    }
    return out;
}

/** Start items → the lines the editor shows ("Rope x3"). */
export const itemsText = items => (Array.isArray(items) ? items : []).map(item => (item.qty > 1 ? `${item.name} x${item.qty}` : item.name)).join('\n');

/**
 * Over `root()` (the storySuite settings object): `read()` → `{ rankLabel: string, money: integer | null, items: [{ name, qty }] }` (blank, null and empty
 * when the reader set nothing) and `set(key, value)` for `rankLabel`, `money` (a whole number from 0, or blank/null to clear) and `items` (a list or the editor's text) → true when it changed something valid.
 */
export function createOwn(root) {
    const read = () => {
        const you = record(root().you), start = record(root().start);
        const items = Array.isArray(start.items) ? start.items.filter(item => item && typeof item.name === 'string' && item.name.trim()).map(item => ({ name: item.name, qty: Math.max(1, Number(item.qty) || 1) })) : [];
        const label = typeof you.rankLabel === 'string' ? you.rankLabel.trim() : '';
        const money = Number.isInteger(start.money) && start.money >= 0 ? start.money : null;
        return { rankLabel: label, money, items };
    };
    const set = (key, value) => {
        const base = root();
        if (key === 'rankLabel') {
            const label = String(value ?? '').trim().slice(0, LABEL_CHARS);
            base.you = { ...record(base.you), rankLabel: label };
            if (!label) delete base.you.rankLabel;
            return true;
        }
        if (key === 'money') {
            const blank = value === null || value === undefined || String(value).trim() === '';
            const n = Number(value);
            if (!blank && !(Number.isInteger(n) && n >= 0 && n <= MAX_MONEY)) return false;
            base.start = { ...record(base.start) };
            if (blank) delete base.start.money; else base.start.money = n;
            return true;
        }
        if (key === 'items') {
            const items = Array.isArray(value) ? value : parseItems(value);
            base.start = { ...record(base.start), items };
            if (!items.length) delete base.start.items;
            return true;
        }
        return false;
    };
    return { read, set };
}
