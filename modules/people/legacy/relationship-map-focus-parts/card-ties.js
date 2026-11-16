// The selected person's ties on the map and the card's numbers line.

import { plain, signed } from '../relationship-map-core.js';
import { bondLine } from './map-markup.js';

// The people the selected one is tied to on the map, with the relation word and tone (from the model's bond lines, so it needs no focus).
export function selectedTies(model) {
    const id = model?.selected?.id;
    if (!id) return [];
    const names = new Map((model.nodes || []).map(node => [node.id, node.name]));
    return (model.lines || []).filter(line => line.a === id || line.b === id).map(line => {
        const other = line.a === id ? line.b : line.a;
        const { word, tone, fromTag } = bondLine(line, { prefer: id });
        const relation = plain(line.relation?.[id]) || plain(line.relation?.[other]);
        return { id: other, name: names.get(other) || '', word, fromTag, tone, relation, dynamic: plain(line.dynamic?.[id]) || plain(line.dynamic?.[other]) };
    }).sort((a, b) => a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));
}

// "Warmth +11 · Trust +11 · Tension +13": the selected person's numbers toward the player (the dial in the card carries all four).
export function cardNumberItems(selected) {
    const by = Object.fromEntries((selected?.axes || []).map(axis => [axis.key, axis.value]));
    const warmth = Math.round(((by.trust || 0) + (by.affection || 0)) / 2);
    return [['Warmth', warmth], ['Trust', by.trust || 0], ['Tension', by.tension || 0]].map(([label, value]) => `${label} ${signed(value)}`);
}

export function cardNumbersLine(selected) {
    return cardNumberItems(selected).join(' · ');
}
