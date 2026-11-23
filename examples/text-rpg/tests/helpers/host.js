// A whole Story Block host (the testkit) with the Text RPG module registered through the public sdk shapes only.
import { createHost } from '../../../../testkit/index.js';
import { textRpgModule } from '../../src/module.js';

export const BUY = { str: 9, vit: 9, agi: 9, dex: 9, int: 8, wis: 8, cha: 8 };
export const SKILLS = [
    { name: 'Obscure', about: 'melts into shadow', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 2 } },
    { name: 'Lore', about: 'old stories', stat: 'int', type: 'utility' },
];

export const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
export const slice = host => host.head().domains.textRpg;
export const sent = (host, key) => host.st.promptLog.filter(entry => entry.key === key && entry.value).map(entry => entry.value);

/** `features`: the reader's feature choices; Text RPG is on unless told otherwise. */
export async function newHost(features = {}) {
    let host = null;
    const sdk = { feature: id => host.sdk.feature(id), command: (...args) => host.sdk.command(...args), query: (...args) => host.sdk.query(...args) };
    host = await createHost({ modules: [textRpgModule(sdk)], settings: { features: { 'text-rpg.on': true, ...features } } });
    return host;
}

/** A host with Astra made through the command. */
export async function withAstra(features) {
    const host = await newHost(features);
    const made = await host.sdk.command('textRpg.create', { name: 'Astra', stats: BUY, skills: SKILLS });
    if (!made.ok) throw new Error(made.message);
    return host;
}

export const astraOf = host => Object.values(slice(host).members).find(member => member.pc);

/** The receipts the `? try` lines made, oldest first. */
export const tries = host => host.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'capture.try');

/** The `{ list, floor }` of the latest dice step (what the next reply's lines and tail use). */
export const drawn = host => host.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'textRpg.dice').at(-1)?.data ?? null;
