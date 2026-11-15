// Finds the bars the told lines moved and words where they stand.

import { STAGES, stageWord } from '../names.js';

/** The bars the told lines moved, from `start` (id → bar): [{ id, kind, name, module, field, from, to, size }] (one per bar). */
export function hurtsOf(start, lines) {
    const moved = new Map();
    for (const line of lines) {
        // (a hit or a heal moves Health; a skill's cost moves Stamina or Mana)
        for (const damage of [line.damage, line.cost]) {
            if (!damage) continue;
            const before = start.get(damage.id), seen = moved.get(damage.id);
            moved.set(damage.id, { id: damage.id, kind: damage.kind, name: damage.name, module: before.module, field: before.field, from: seen?.from ?? damage.from, to: damage.to, size: damage.size });
        }
    }
    return [...moved.values()].filter(item => item.from !== item.to);
}

// "Wessel Hurt; Sluice Rats Wounded": where the bars the told lines moved stand now, as words.
export const barsLine = (start, lines) => hurtsOf(start, lines).map(item => {
    const own = item.field === 'stamina' || item.field === 'mana';
    return `${item.name} ${own ? `${item.field === 'mana' ? 'Mana' : 'Stamina'} ` : ''}${stageWord(own ? STAGES[item.field] : STAGES.health, item.to, item.size)}`;
}).join('; ');
