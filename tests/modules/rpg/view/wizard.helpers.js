import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILL_SETS } from '../../../../modules/rpg/templates.js';
import { begin, makeBlocks, page, party, settle } from './page.js';

export const PACK = JSON.parse(readFileSync(new URL('../fixtures/skill-sets-pack.json', import.meta.url), 'utf8'));
export const CHECK = { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'] };
export const FIGHTER = SKILL_SETS[0];

export const ctxDialog = ctx => ctx.ui.mounts.dialog.current();
export const wizardOf = dialog => dialog.root.querySelector('.ss-w-rpg-wizard');
export const click = (root, text) => root.querySelectorAll('button').find(node => node.textContent === text)?.click();
export const type = (node, value) => { node.value = value; node.dispatch('input'); };
export async function openFrom(ctx, { empty = false } = {}) {
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    party(ctx.doc).querySelector(empty ? '.rpg-create' : '.rpg-new').click();
    await settle();
    return ctx.ui.mounts.dialog.current();
}
export const goTo = async (dialog, step) => { dialog.goTo(['who', 'stats', 'skills', 'review'].indexOf(step)); await settle(); return wizardOf(dialog); };
export const names = host => Object.keys(host.head().domains.dataModules?.active ?? {}).sort();

// A reply with `used` block actions on it: the Character and Skills blocks (two defines) and then sets of one field.
export async function usedReply(t, used) {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await makeBlocks(ctx.host);
    for (let n = 0; n < used - 2; n += 1) {
        const set = await ctx.host.sdk.command('dm.set', { module: 'pack.chat/wessel', field: 'str', value: 12 + (n % 2) });
        assert.equal(set.ok, true, set.message);
    }
    assert.equal(Object.values(ctx.host.head().domains.dataModules.perReply)[0].roots, used);
    return ctx;
}
export async function companion(ctx, name) {
    const dialog = await openFrom(ctx);
    click(wizardOf(dialog), 'A companion');
    type(wizardOf(dialog).querySelector('[data-wiz="name"]'), name);
    await goTo(dialog, 'review');
    return dialog;
}

export const rolesOf = host => { const domain = host.head().domains.dataModules; return Object.keys(domain?.active ?? {}).map(id => domain.pins[domain.active[id].hash].definition.role).sort(); };
export const createFrom = async (ctx, { empty = true } = {}) => {
    const dialog = await openFrom(ctx, { empty });
    const review = await goTo(dialog, 'review');
    return { dialog, review };
};
