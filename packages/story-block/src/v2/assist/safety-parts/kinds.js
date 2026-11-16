// The Assist extractor's allow-list: its default kinds, the chips the settings page offers, and the reading of the stored setting.

// The default allow-list: time, place, who is here, weather, quest progress / met / turn-in, wounds and
// conditions (no heal), and an item handed over or used up (`- item`: only what the party holds).
export const DEFAULT_KINDS = '! time, ~ time, ~ place, + present, - present, ~ weather, ~ quest, - quest, ~ wound, - item';

// The kinds the settings page offers as chips: the default allow-list in order, followed by optional kinds the wall
// lets through. Coin, new items, XP, loot, heals and rewards have no chip: the wall never writes them, whatever is stored
// (a test keeps every chip on the right side of it).
export const KIND_CHOICES = Object.freeze([
    Object.freeze({ value: '! time', label: 'Time set' }),
    Object.freeze({ value: '~ time', label: 'Time moves on' }),
    Object.freeze({ value: '~ place', label: 'Place' }),
    Object.freeze({ value: '+ present', label: 'Someone arrives' }),
    Object.freeze({ value: '- present', label: 'Someone leaves' }),
    Object.freeze({ value: '~ weather', label: 'Weather' }),
    Object.freeze({ value: '~ quest', label: 'Quest progress' }),
    Object.freeze({ value: '- quest', label: 'Quest turned in' }),
    Object.freeze({ value: '~ wound', label: 'Wounds' }),
    Object.freeze({ value: '- item', label: 'Item handed over' }),
    Object.freeze({ value: '+ world', label: 'World news' }),
    Object.freeze({ value: '~ world', label: 'World news update' }),
    Object.freeze({ value: '+ faction', label: 'Faction' }),
    Object.freeze({ value: '~ faction', label: 'Faction update' }),
    // Closing a lead adds nothing (it pays no reward): off by default like the other optional chips, and allowed after send.
    Object.freeze({ value: '- hook', label: 'Hook closed' }),
]);

/** The allow-list setting read: a Set of "op kind" keys ("~ time", "- item"); junk entries are skipped. */
export function allowedKinds(text = DEFAULT_KINDS) {
    const out = new Set();
    for (const part of String(text ?? '').split(/[,;\n]+/)) {
        const match = /^\s*([+\-~!?])\s*(\p{L}[\p{L}\p{N}_-]*)\s*$/u.exec(part);
        if (match) out.add(`${match[1]} ${match[2].toLowerCase()}`);
    }
    return out;
}
