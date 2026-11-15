import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createCoreModule } from '../../src/v2/domains/index.js';

export const ON = { extra: { feature: id => id === 'story-block.gear' || id === 'story-block.rpg' } };
export const OFF = { extra: { feature: () => false } };
export const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const tail = host => host.st.promptLog.filter(entry => entry.key === 'story_suite_tail_1' && entry.value).at(-1)?.value ?? '';
export const defsOf = host => host.head().domains.inventory.defs;
export const defNamed = (host, name) => Object.values(defsOf(host)).find(item => item.name === name);

// A rules module of the kind part 2 will be: it wears the piece in a slot from a story line (`~ hit weapon tear`).
export const FIGHT = {
    id: 'zz-fight', name: 'zz fight', version: '0.0.0',
    capture: {
        kinds: { hit: { grammar: '~ hit <slot> <steps>' } },
        apply(ctx, change) {
            const [slot, steps] = change.name.split(' ');
            return ctx.call('gear.wear', { owner: 'party', slot, steps: Number(steps ?? 1) });
        },
    },
};

export async function fresh(t, { gear = true, modules = [FIGHT] } = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules, settings: gear ? { features: { 'story-block.gear': true, 'story-block.rpg': true } } : {} });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    return host;
}

export const wear = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name);
export const equip = async (host, name) => {
    const out = await host.sdk.command('inventory.equip', { stack: wear(host, name).stack });
    assert.equal(out.ok, true, out.message);
};

export const gearCore = () => createCoreModule({ hooks: () => [], settings: () => ({}), extras: { gearOn: () => true } });

export const staticOf = host => host.st.promptLog.filter(entry => entry.key === 'story_suite_static' && entry.value).at(-1)?.value ?? '';
export const ITEM_LINE = '+ item Name | qty: 1 | note: short detail (- item Name | qty: 1 when used up or lost; ~ item Name | note: … when it changes)';
