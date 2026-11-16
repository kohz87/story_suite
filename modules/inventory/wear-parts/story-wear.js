// Reads the story's wear word for a piece and applies it.

import { COND_MAX, condWrite, gearOn } from '../state.js';
import { stacksOf } from '../stacks.js';

// The story's word for wear on a piece (`~ item Coat — torn by brambles | wear: scuff|tear|ruin`). With a
// module answering `item.wear` (a module's gear rules) the line goes
// there as `item.wear { name, wear, why, story: true }`; without one Story Block wears the stack itself
// by STORY_WEAR, once per piece per reply. The words and numbers are shared by the fallback, so
// both read a line the same way.
export const STORY_WEAR = Object.freeze({ scuff: 5, tear: 15, ruin: 40 });

const WEAR_WORDS = Object.freeze({
    scuff: 'scuff', scuffed: 'scuff', scratch: 'scuff', scratched: 'scuff', nick: 'scuff', nicked: 'scuff', dent: 'scuff', dented: 'scuff',
    tear: 'tear', torn: 'tear', tore: 'tear', rip: 'tear', ripped: 'tear', cut: 'tear', gash: 'tear', crack: 'tear', cracked: 'tear', burn: 'tear', burned: 'tear', burnt: 'tear',
    ruin: 'ruin', ruined: 'ruin', wreck: 'ruin', wrecked: 'ruin', smash: 'ruin', smashed: 'ruin', shatter: 'ruin', shattered: 'ruin', destroy: 'ruin', destroyed: 'ruin',
});

/** scuff | tear | ruin for a wear label's words, or null. */
export function wearWord(value) {
    const said = String(value ?? '').normalize('NFKC').toLowerCase().trim().split(/[^a-z]+/).filter(Boolean);
    for (const word of said) if (Object.hasOwn(WEAR_WORDS, word)) return WEAR_WORDS[word];
    return null;
}

export function storyWear(ctx, inv, def, written, why) {
    const word = wearWord(written);
    if (!word) ctx.fail('INVALID', 'Say how the piece suffered: wear: scuff, wear: tear or wear: ruin.');
    let out;
    try {
        out = ctx.call('item.wear', { name: def.name, wear: word, ...(why ? { why } : {}), story: true });
    } catch (error) {
        if (!(error?.code === 'UNKNOWN_COMMAND' && String(error.message).includes('item.wear'))) throw error;
        out = null;
    }
    if (out) return typeof out.summary === 'string' && out.summary ? out.summary : `${def.name}: ${word}.`;
    // Without a gear module: the piece worn, else the first lot (as `- item` takes them).
    const held = stacksOf(inv, def.id);
    const stack = held.find(other => other.equipped !== null) ?? held[0];
    if (!stack) ctx.fail('NOT_FOUND', `There is no ${def.name} in the inventory.`);
    const reply = ctx.carrier?.sid ?? ctx.receiptId ?? '';
    if (!ctx.claim(`wear:${reply}:${stack.id}`)) ctx.fail('CLAIMED', `${def.name} already took its wear in this reply.`);
    // With gear on a ruin breaks the piece in one step; scuff and tear are as they were.
    const now = condWrite(ctx, inv, stack, word === 'ruin' && gearOn(ctx) ? -COND_MAX : -STORY_WEAR[word]);
    return now === 0 ? `${def.name} is broken` : `${def.name} is ${{ scuff: 'scuffed', tear: 'damaged', ruin: 'badly damaged' }[word]} (${now}/100)`;
}
