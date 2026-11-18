// Shared fixtures and helpers for the character-import test suite: a saved character file, and Create run on it (the wizard's run, create-run.js).
import { CHAR_FILE, parseCharacterFile } from '../../../../modules/rpg/charfile.js';
import { withImport } from '../../../../modules/rpg/view/wizard-data.js';
import { begin, makeBlocks, page, settle } from './page.js';
import { create, draftOf } from './wizard.helpers.js';

export const names = host => Object.keys(host.head().domains.dataModules?.active ?? {}).sort();
export const carried = host => host.sdk.query('inventory.items', {}).map(item => `${item.name}${item.qty === 1 ? '' : ` ×${item.qty}`}`).sort();
export const purseOf = host => host.sdk.query('inventory.wallet', { owner: 'party' }).coin ?? 0;
export const receiptTypes = host => host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).map(receipt => receipt.type);
export const defsOf = host => Object.values(host.head().domains.inventory.defs);

// A saved Wessel, written the way Export writes it, to import into another chat.
export const SAVED = JSON.stringify({
    [CHAR_FILE]: 1, soul: 2, points: 3, stats: { str: 14, vit: 12, agi: 11, dex: 10, int: 8, wis: 9, cha: 10 },
    skills: [{ name: 'Iron Breath', about: 'Steadies the lungs in a long fight.', stat: 'vit', uses: 'stamina', rank: 2 }, { name: 'Short blade', about: 'Quick cuts at close range.', stat: 'agi', uses: 'stamina', rank: 0 }],
    items: [{ name: 'Oilskin Coat', qty: 1, note: 'waxed, a little too big', kind: 'equipment', rarity: 'uncommon' }, { name: 'Bedroll', qty: 1 }, { name: 'Torch', qty: 2 }], money: 50,
});

// Another chat that has Wessel already, so the import makes a companion (Ren).
export async function newcomer(t, options = {}) {
    const ctx = await page(t, { persona: 'Wessel', ...options });
    await begin(ctx.host);
    await makeBlocks(ctx.host, { who: 'Wessel' });
    await settle();
    return ctx;
}

/** The draft the wizard holds after importing `text` for `name` (a You when `kind` is 'you'), and the import record Create is given. */
export function importedDraft(text, name, kind = 'companion') {
    const parsed = parseCharacterFile(text);
    if (!parsed.ok) throw new Error('the file is not good');
    const made = withImport(draftOf(name, kind), parsed.file);
    return { draft: made.draft, imported: { file: parsed.file, fileName: 'wessel.character.json', before: made.before } };
}

/** Create for Ren (a companion) from the saved file `text`. → runCreate's answer. */
export async function createRen(ctx, text = SAVED) {
    const { draft, imported } = importedDraft(text, 'Ren');
    return create(ctx.host, draft, { imported });
}

// The owner's play bug (13 Nov): an imported piece lost its file stats (a Cane Sword with AGI 1 showed DEX; a cloak-slot robe, VIT) because the import kept them only with Gear on.
export const GEAR_FILE = JSON.stringify({ [CHAR_FILE]: 1, level: 1, soul: 1, points: 0, stats: { str: 5, vit: 10, agi: 10, dex: 5, int: 5, wis: 5, cha: 5 },
    skills: [{ name: 'Iaijutsu', about: 'x', stat: 'agi', uses: 'stamina', rank: 0 }],
    items: [{ name: 'Cane Sword', qty: 1, note: 'Hidden blade inside a walking cane', kind: 'equipment', rarity: 'common', slot: 'weapon', stats: { AGI: 1 } },
        { name: 'Linen Clothes', qty: 1, kind: 'equipment', rarity: 'common', slot: 'body', stats: { VIT: 1 } },
        { name: 'Linen Shoes', qty: 1, kind: 'equipment', rarity: 'common', slot: 'feet', stats: { AGI: 1 } },
        { name: 'Traveling Robe', qty: 1, kind: 'equipment', rarity: 'common', slot: 'cloak', stats: { AGI: 1 } },
        { name: 'Traveler\'s Slingbag', qty: 1, carry: 12 }], money: 50 });
