import { hostAvailable } from '../../testkit/index.js';
import { API_EVENTS } from '../../src/v2/public-api.js';
import { sheetDomain, character } from './lean-rpg/helpers.js';

export const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;
export const reply = (...lines) => `The tide turns.\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const settle = () => new Promise(resolve => setTimeout(resolve, 20));
// The next time `name` fires on the api, as a promise.
export const next = (api, name) => new Promise(resolve => { const off = api.on(name, payload => { off(); resolve(payload); }); });
export const record = (api, names = API_EVENTS) => {
    const seen = [];
    for (const name of names) api.on(name, payload => seen.push([name, payload]));
    return seen;
};

// A test module with a data-module domain whose definitions carry state schemas (hidden fields, shown nowhere).
export function blocksModule(blocks, { feature = false } = {}) {
    const domain = sheetDomain(Object.fromEntries(Object.entries(blocks).map(([slug, block]) => [slug, { role: block.definition?.role, fields: block.fields }])));
    Object.entries(blocks).forEach(([slug, block], n) => {
        const definition = domain.pins[`h${n}`].definition;
        if (definition.role === undefined) delete definition.role;
        Object.assign(definition, block.definition ?? {}, { id: `pack.chat/${slug}`, slug, name: block.definition?.name ?? slug });
        if (block.subjects) {
            domain.active[`pack.chat/${slug}`].subjects = block.subjects;
            domain.instances[`pack.chat/${slug}`] = { characters: block.characters };
        }
    });
    return {
        id: 'story-block', name: 'Test', version: '0.0.1',
        features: feature ? [{ id: 'story-block.rpg', label: 'RPG', describe: 'Test.', default: false }] : [],
        domains: { dataModules: { initial: () => domain } },
    };
}

export const PARTY = () => ({
    wessel: { definition: { role: 'character' }, fields: character('Wessel', { level: 4, xp: 30 }) },
    ren: { definition: { role: 'character' }, fields: character('Ren', { str: 8, int: 16, level: 2, xp: 10, health: 3 }) },
});

export const TRACKER = {
    definition: {
        show: { tab: true, card: false },
        state: {
            hope: { type: 'int', min: 0, max: 9, default: 3 },
            dread: { type: 'int', min: 0, max: 9, default: 1, prompt: false },
            title: { type: 'text', max: 40, default: '' },
            marks: { type: 'map', keys: ['a', 'b'], values: { type: 'int', min: 0, max: 5 } },
        },
    },
    fields: { hope: 4, dread: 7, title: 'The Lamp-lighter', marks: { a: 2, b: 0 } },
};
