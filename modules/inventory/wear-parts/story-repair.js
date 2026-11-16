// Reads the story's repair word for a piece and mends or restores it.

import { stepUp } from '../gear.js';
import { condOf, condWrite } from '../state.js';
import { stacksOf } from '../stacks.js';

// The story's word for a repair (`~ item Cane Sword — the smith reground it | repair: mend|restore`), with the gear feature on: mend (mended,
// patched, fixed) is one condition word up, restore (restored, reforged, as new) is back to Good. It goes through the same condition
// events as `inventory.repair`, once per piece per reply; the coin for it stays the narrator's own `- coin` line.
const REPAIR_WORDS = Object.freeze({
    mend: 'mend', mended: 'mend', patch: 'mend', patched: 'mend', fix: 'mend', fixed: 'mend', repair: 'mend', repaired: 'mend', mending: 'mend',
    restore: 'restore', restored: 'restore', reforge: 'restore', reforged: 'restore', new: 'restore', renewed: 'restore',
});

export function storyRepair(ctx, inv, def, written) {
    const said = String(written ?? '').normalize('NFKC').toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const word = said.map(item => REPAIR_WORDS[item]).find(Boolean);
    if (!word) ctx.fail('INVALID', 'Say how the piece was mended: repair: mend or repair: restore.');
    // The piece worn, else the most worn lot.
    const held = stacksOf(inv, def.id);
    const stack = held.find(other => other.equipped !== null) ?? [...held].sort((a, b) => condOf(a, inv) - condOf(b, inv))[0];
    if (!stack) ctx.fail('NOT_FOUND', `There is no ${def.name} in the inventory.`);
    const reply = ctx.carrier?.sid ?? ctx.receiptId ?? '';
    if (!ctx.claim(`repair:${reply}:${stack.id}`)) ctx.fail('CLAIMED', `${def.name} was already mended in this reply.`);
    const before = condOf(stack, inv);
    const target = stepUp(before, word === 'restore');
    if (target <= before) return `${def.name} is already as good as new`;
    const now = condWrite(ctx, inv, stack, target - before);
    return `${def.name} is ${word === 'restore' ? 'restored' : 'mended'} (${before} → ${now}/100)`;
}
