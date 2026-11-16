// A kind that changes the real inventory, and a host (real core, real bus) that has it registered, for the settle and mark tests.

import { createHost } from '../../../../testkit/index.js';
import { hashJson } from '../../../../core/replay.js';

export const KIND_ID = 'test/probe';

export function growKind(overrides = {}) {
    return {
        version: 1, title: 'Probe', feature: null, screen: 'test/probe', limits: {}, changes: ['inventory.grant'],
        ready: () => true,
        open: () => ({ setup: {} }),
        witness: state => ({ stacks: Object.keys(state.domains.inventory?.stacks ?? {}).length }),
        validate: () => null,
        actors: () => [{ id: 'hero', name: 'Astra', party: true }],
        play: () => ({ view: {}, result: { stop: 'done' }, stop: 'done' }),
        settle: () => ({ result: { stop: 'done' }, changes: [{ type: 'inventory.grant', payload: { name: 'Rope', qty: 2 } }], stop: 'done' }),
        note: () => ['Probe settled.'],
        ...overrides,
    };
}

export const kindModule = (kind, { id = 'test', version = '1.0.0' } = {}) => ({ id, version, interactions: { probe: kind } });

export const hostWith = (kind, options = {}) => createHost({ modules: [kindModule(kind, options)] });

export function settlePayload(host, kind, { anchor = 'a', offset = 0, seed = 7 } = {}) {
    const id = `${anchor}:${offset}:${KIND_ID}`, setup = {};
    return {
        v: 1, kindId: KIND_ID, version: kind.version, key: `i:${encodeURIComponent(id)}:${encodeURIComponent(anchor)}:${offset}`,
        id, anchor, seed, offset, setup, steps: [{ inputs: [{ actor: 'hero', choice: 'go' }] }],
        witness: { offset, hash: hashJson(kind.witness(host.head(), setup)) }, player: 'hero', policy: { choosers: 'own', party: false },
    };
}

export const settleOn = (host, payload) => host.bus.command('interaction.settle', payload, { cause: 'system' });
