import assert from 'node:assert/strict';
import { STANDARD_TEMPLATES } from '../../../../src/v2/lean-rpg/templates.js';
import { combatBlock } from '../../../../src/v2/lean-rpg/view/settings-data.js';
import { begin, makeBlocks, page, settle } from './page.js';

export const MOD = 'story-block';
export const rail = doc => doc.querySelectorAll('.ss-settings .ss-tabs-label').map(node => node.textContent);
export const combat = () => structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === 'Combat rules').definition);
export const promptOf = host => combatBlock(host.head(), {})?.prompt;

// The page, opened on its section, with Wessel (STR 12, Soul Class I, Adept) made from the real templates.
export async function open(t, { blocks = true, rules = false, wrap = null } = {}) {
    const ctx = await page(t, { feature: true, persona: 'Wessel', wrap });
    await begin(ctx.host);
    if (blocks) await makeBlocks(ctx.host, { who: 'Wessel', character: { str: 12, soul: 1 }, skills: { skill1: 'Iron Breath', stat1: 'str', rank1: 1 } });
    if (rules) assert.equal((await ctx.host.sdk.command('dm.define', { definition: combat() })).ok, true);
    const win = ctx.ui.openSettings();
    win.select('rpg');
    await settle();
    const root = ctx.doc.querySelector('[data-ss-section="rpg"]');
    const card = name => root.querySelector(`[data-card="${name}"]`);
    return { ...ctx, win, root, card, stored: () => ctx.host.settings(MOD) };
}
export const oddsText = card => card.querySelector('.rpg-odds-legend').textContent;
export const typeInto = (node, value, event = 'change') => { node.value = value; node.dispatch(event); };
