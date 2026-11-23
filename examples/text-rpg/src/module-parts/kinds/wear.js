// What a `? try` in danger costs the gear: a bad failure wears each piece the roll used one condition step (good → worn → torn → broken), what one exchange of a board fight wears (rpg gear-parts/wear.js); a success at a cost wears nothing.
import { ask } from '../gear.js';

const STEPS = { bad: 1 };
const HANDS = ['str', 'dex'];

/**
 * Wears the member's worn pieces the roll used through the inventory's `gear.wear` (the reader's character wears the party's bag): the weapon for a
 * physical attack try (an attack skill or STR or DEX), the body armour (else the off-hand) when the member took wounds. A piece that is missing or broken wears nothing.
 * → [{ slot, stack, steps, before, now, broken }] for the receipt; empty out of danger, for a good band, or while the inventory answers no gear.
 */
export function wearGear(ctx, member, { band, inDanger, stat, skill, wounded }) {
    const steps = STEPS[band];
    if (!inDanger || !steps) return [];
    const owner = member.pc ? 'party' : member.id;
    const worn = ask(ctx.query, 'gear.view', { owner })?.slots;
    if (!worn || typeof ctx.call !== 'function') return [];
    const live = place => (worn[place] && worn[place].broken !== true ? worn[place] : null);
    const asks = [];
    if (live('weapon') && (HANDS.includes(stat) || skill?.type === 'attack')) asks.push(['weapon', 'weapon']);
    if (wounded) asks.push(live('body') ? ['body', 'body'] : live('off-hand') ? ['off-hand', 'off-hand'] : null);
    return asks.filter(Boolean).map(([place, slot]) => {
        const done = ctx.call('gear.wear', { owner, slot, steps, recorded: true })?.data ?? {};
        return { slot: place, stack: done.stack, steps, before: done.before, now: done.now, broken: done.broken === true };
    });
}
