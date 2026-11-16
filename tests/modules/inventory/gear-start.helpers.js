import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../packages/story-block/testkit/index.js';
import { validatePack } from '../../../packs/validate.js';
import { pack } from '../../packs/helpers/fixtures.js';

const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;
export const reply = (...lines) => `The tide turns.\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_astra001', name: 'Astra', pc: true }, { id: 'ac_harrak01', name: 'Harrak' }], 'party.pc': () => ({ id: 'ac_astra001' }) } };
export const ITEMS = [{ name: 'Rain-Veil Hood', kind: 'equipment', slot: 'head', rarity: 'rare' }];

export async function world(t, { gear = true, packs = false, items = ITEMS } = {}) {
    t.mock.method(console, 'warn', () => {});
    const settings = { features: gear ? { 'story-block.gear': true, 'story-block.rpg': true } : {} };
    if (packs) {
        const raw = pack({ content: { items } });
        const built = validatePack(raw);
        assert.equal(built.ok, true, JSON.stringify(built.errors));
        settings.packs = [{ id: built.pack.id, version: built.pack.version, enabled: true, source: 'file', origin: 'test', pack: raw }];
    }
    const host = await createHost({ modules: [ACTORS], settings });
    t.after(() => host.close());
    return host;
}
export const add = (host, payload) => host.sdk.command('inventory.add', { qty: 1, ...payload });
export const rowOf = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name);
export const defOf = (host, name) => Object.values(host.head().domains.inventory.defs).find(item => item.name === name);
export const refused = async (promise, pattern) => {
    const out = await promise;
    assert.equal(out.ok, false, 'should be refused');
    assert.match(out.message ?? out.error?.message ?? JSON.stringify(out), pattern);
    return out;
};
export const kit = host => host.sdk.query('gear.view')?.kit;
export const READER = 'ac_astra001';
