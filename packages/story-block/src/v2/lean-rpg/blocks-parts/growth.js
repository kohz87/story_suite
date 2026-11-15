// A new character's full bars and the growth line under its skills.
import { blocksFor, LUCK_STEPS, luckWindow } from '../formula.js';
import { whole } from './shared-whole.js';

/** What a new character's bars hold for `stats`: full bars, and the sizes the Standard Character block's rules compare against. */
export function barFields(stats, scale = 1) {
    const size = blocksFor(stats, scale);
    return { health: size.health, stamina: size.stamina, mana: size.mana, 'health-blocks': size.health, 'stamina-blocks': size.stamina, 'mana-blocks': size.mana };
}

const nextAbove = (value, step) => (Math.floor(whole(value) / step) + 1) * step;

/**
 * The line under a character's skills: how many blocks each bar has and the stat that earns the next one, and luck with the next
 * step. `{ health: { blocks, stat, value, next }, stamina, mana, luck: { min, max, stat, current, next } }` (`next` is the stat value that
 * brings one more block, or null when there is none to come: the edge window steps at LUK 5, 7, 11, 13, 15, 17 and 19, and a bar stops growing at the stat maximum).
 */
export function growthOf(stats, { statMax = 20, scale = 1 } = {}) {
    const size = blocksFor(stats, scale);
    const bar = (blocks, stat) => { const next = nextAbove(stats?.[stat], 5); return { blocks, stat, value: whole(stats?.[stat]), next: next <= statMax ? next : null }; };
    const luk = whole(stats?.luk), step = LUCK_STEPS.find(at => at > luk) ?? null;
    return { health: bar(size.health, 'vit'), stamina: bar(size.stamina, 'agi'), mana: bar(size.mana, 'int'), luck: { ...luckWindow(luk), stat: 'luk', current: luk, next: step } };
}
