// Shared fixtures and helpers for the char-export test suite.
import assert from 'node:assert/strict';
import { CHAR_FILE } from '../../../../modules/rpg/charfile.js';
import { begin, makeBlocks, page, party, settle } from './page.js';
import { characterDefinition, skillsDefinition } from './helpers.js';
import { asCompanion, openFrom } from './wizard.helpers.js';

export const goTo = async (dialog, step) => { dialog.goTo(['who', 'stats', 'skills', 'review'].indexOf(step)); await settle(); return dialog.root.querySelector('.ss-w-rpg-wizard'); };
export const wizardOf = dialog => dialog.root.querySelector('.ss-w-rpg-wizard');
export const exportOf = dialog => dialog.root.querySelector('.ss-w-rpg-export');
export const type = (node, value) => { node.value = value; node.dispatch('input'); };
export const click = (root, text) => root.querySelectorAll('button').find(node => node.textContent === text)?.click();
export const file = (name, text) => ({ name, size: text.length, text: async () => text });

// What the saved-file download does on the fake page: every Blob it was given and the name it was saved as.
export function captureSaves(ctx) {
    const saves = [];
    ctx.doc.defaultView.Blob = class { constructor(parts, options) { this.text = parts.join(''); this.type = options.type; } };
    ctx.doc.defaultView.URL = { createObjectURL: blob => { saves.push({ blob }); return 'blob:test'; }, revokeObjectURL() {} };
    const create = ctx.doc.createElement;
    ctx.doc.createElement = tag => {
        const node = create(tag);
        if (tag === 'a') node.addEventListener('click', () => { saves.at(-1).name = node.download; });
        return node;
    };
    return saves;
}

export const WESSEL = { str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10, points: 3, soul: 2, xp: 40, health: 3, mana: 2, stamina: 1, about: 'A drill-yard washout from Bluewatch.' };
export const WESSEL_SKILLS = { skill1: 'Iron Breath', about1: 'Steadies the lungs in a long fight.', stat1: 'vit', uses1: 'stamina', rank1: 2, practice1: 55,
    skill2: 'Short blade', about2: 'Quick cuts at close range.', stat2: 'agi', uses2: 'stamina', rank2: 0, practice2: 10 };

// A story with Wessel (you, with skills, a bedroll, a coat, two torches and a purse) and, when asked, Ren (a companion).
export async function story(t, { companion = false, purse = 50, things = true } = {}) {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await makeBlocks(ctx.host, { who: 'Wessel', character: WESSEL, skills: WESSEL_SKILLS });
    if (companion) await makeBlocks(ctx.host, { who: 'Ren' });
    if (things) {
        for (const payload of [{ name: 'Bedroll', qty: 1 }, { name: 'Oilskin Coat', qty: 1, note: 'waxed, a little too big', kind: 'equipment', rarity: 'uncommon' }, { name: 'Torch', qty: 2 }]) {
            const added = await ctx.host.sdk.command('inventory.add', payload);
            assert.equal(added.ok, true, added.message);
        }
    }
    if (purse) assert.equal((await ctx.host.sdk.command('wallet.set', { amount: purse })).ok, true);
    await settle();
    return ctx;
}
export async function exportDialog(ctx, who = 'Wessel') {
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    party(ctx.doc).querySelector(`.rpg-card[data-character="${who}"] .rpg-export-open`).click();
    await settle();
    return ctx.ui.mounts.dialog.current();
}
export async function saveFrom(ctx, who = 'Wessel') {
    const saves = captureSaves(ctx);
    const dialog = await exportDialog(ctx, who);
    exportOf(dialog).querySelector('.rpg-exp-save').click();
    await settle();
    assert.equal(saves.length, 1, 'one file saved');
    return { text: saves[0].blob.text, name: saves[0].name, type: saves[0].blob.type, dialog };
}
export const wizardWith = openFrom;
export async function importInto(dialog, text, name = 'wessel.character.json') {
    const input = wizardOf(dialog).querySelector('.rpg-import-file');
    input.files = [file(name, text)];
    input.dispatch('change');
    await settle();
}
export const names = host => Object.keys(host.head().domains.dataModules?.active ?? {}).sort();
export const carried = host => host.sdk.query('inventory.items', {}).map(item => `${item.name}${item.qty === 1 ? '' : ` ×${item.qty}`}`).sort();
export const purseOf = host => host.sdk.query('inventory.wallet', { owner: 'party' }).coin ?? 0;
export const receiptTypes = host => host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).map(receipt => receipt.type);

// A stand-in for a party module: it lists the party's people, so the inventory knows who can hold things.
export const PARTY_STUB = actors => ({ id: 'party-stub', version: '1.0.0', queries: { 'party.actors': () => actors } });
export const REN = { id: 'ac_ren00001', name: 'Ren' };

// A saved Wessel, written the way Export writes it, to import into another chat.
export const SAVED = JSON.stringify({
    [CHAR_FILE]: 1, soul: 2, points: 3, stats: { str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10 },
    skills: [{ name: 'Iron Breath', about: 'Steadies the lungs in a long fight.', stat: 'vit', uses: 'stamina', rank: 2 }, { name: 'Short blade', about: 'Quick cuts at close range.', stat: 'agi', uses: 'stamina', rank: 0 }],
    items: [{ name: 'Oilskin Coat', qty: 1, note: 'waxed, a little too big', kind: 'equipment', rarity: 'uncommon' }, { name: 'Bedroll', qty: 1 }, { name: 'Torch', qty: 2 }], money: 50,
});
export const without = (...keys) => JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(SAVED)).filter(([key]) => !keys.includes(key))));

// Another chat that has Wessel already, so the import makes a companion (Ren).
export async function newcomer(t, options = {}) {
    const ctx = await page(t, { persona: 'Wessel', ...options });
    await begin(ctx.host);
    await makeBlocks(ctx.host, { who: 'Wessel' });
    await settle();
    return ctx;
}
export const companion = (dialog, name = 'Ren') => asCompanion(dialog, name);

export async function createRen(ctx, text = SAVED) {
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, text);
    const review = await goTo(dialog, 'review');
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    return dialog;
}

// The owner's play bug (13 Nov): an imported piece lost its file stats (a Cane Sword with AGI 1 showed DEX; a cloak-slot robe, VIT) because the import kept them only with Gear on.
export const GEAR_FILE = JSON.stringify({ [CHAR_FILE]: 1, level: 1, soul: 1, points: 0, stats: { str: 5, vit: 10, agi: 10, dex: 5, int: 5, luk: 5, cha: 5 },
    skills: [{ name: 'Iaijutsu', about: 'x', stat: 'agi', uses: 'stamina', rank: 0 }],
    items: [{ name: 'Cane Sword', qty: 1, note: 'Hidden blade inside a walking cane', kind: 'equipment', rarity: 'common', slot: 'weapon', stats: { AGI: 1 } },
        { name: 'Linen Clothes', qty: 1, kind: 'equipment', rarity: 'common', slot: 'body', stats: { VIT: 1 } },
        { name: 'Linen Shoes', qty: 1, kind: 'equipment', rarity: 'common', slot: 'feet', stats: { AGI: 1 } },
        { name: 'Traveling Robe', qty: 1, kind: 'equipment', rarity: 'common', slot: 'cloak', stats: { AGI: 1 } },
        { name: 'Traveler\'s Slingbag', qty: 1, carry: 12 }], money: 50 });
export const defsOf = host => Object.values(host.head().domains.inventory.defs);

// A Skills block as old chats have it: names, ranks and practice, and no stat, resource or "what it does" fields.
export async function oldSkillsBlock(host, who = 'Wessel') {
    const defs = [characterDefinition('wessel', who), skillsDefinition('wessel-skills', who)].map(definition => ({ ...definition, role: definition.slug.endsWith('skills') ? 'skills' : 'character' }));
    for (const definition of defs) {
        const { state, ...rest } = definition;
        const plain = Object.fromEntries(Object.entries(state).map(([key, { names, ...field }]) => [key, field]));
        const made = await host.sdk.command('dm.define', { definition: { ...rest, state: plain } });
        assert.equal(made.ok, true, `${definition.slug}: ${made.message}`);
    }
    for (const [field, value] of [['skill1', 'Iron Breath'], ['rank1', 2]]) assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/wessel-skills', field, value })).ok, true);
}
