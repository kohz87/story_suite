import assert from 'node:assert/strict';
import { CHOOSER_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { combatBlock, withPrompt } from '../../../../modules/rpg/view/settings-data.js';
import { begin, makeBlocks, page } from './page.js';

export const combat = () => structuredClone(CHOOSER_TEMPLATES.find(entry => entry.name === 'Combat rules').definition);
export const promptOf = host => combatBlock(host.head(), {})?.prompt;

// A chat with Wessel (STR 12, Soul Class I, Adept) made from the real templates and, when asked, the Combat rules block.
export async function open(t, { blocks = true, rules = false, wrap = null } = {}) {
    const ctx = await page(t, { feature: true, persona: 'Wessel', wrap });
    await begin(ctx.host);
    if (blocks) await makeBlocks(ctx.host, { who: 'Wessel', character: { str: 12, soul: 1 }, skills: { skill1: 'Iron Breath', stat1: 'str', rank1: 1 } });
    if (rules) assert.equal((await ctx.host.sdk.command('dm.define', { definition: combat() })).ok, true);
    return ctx;
}

/** What the Combat rules text is saved as: the block's own definition with the new prompt, through `dm.redefine` (the command the settings' save sent). `command` may stand in for the host's. */
export function saveCombat(host, text, command = (type, payload) => host.sdk.command(type, payload)) {
    const block = combatBlock(host.head(), {});
    return command('dm.redefine', { module: block.module, definition: withPrompt(block.definition, text) });
}
