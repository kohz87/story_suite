import { installFakeDom } from '../../../../../../tests/helpers/ui-fake-dom.js';
import { createRegistry } from '../../../../../../core/registry.js';
import { createSettings } from '../../../../../../core/sdk.js';
import { renderSettingsForm } from '../../../../src/v2/view/form/index.js';

export const doc = installFakeDom();

export const SCHEMA = {
    strict: { type: 'bool', label: 'Strict checks', help: 'Code picks the stat.' },
    harder: { type: 'int', label: 'Difficulty', min: 1, max: 5, readOnly: values => values.strict !== true, shows: () => 3 },
    title: { type: 'text', label: 'Title', max: 8 },
    notes: { type: 'text', multiline: true, label: 'Notes', max: 40 },
    pace: { type: 'choice', form: 'chips', label: 'Pace', options: ['slow', 'steady', 'fast'] },
    prices: { type: 'choice', label: 'Prices', options: [{ value: 'by-place', label: 'By place' }, { value: 'flat', label: 'Flat' }] },
    budget: { type: 'int', form: 'slider', min: 0, max: 200, label: 'Money: Budget' },
    coins: { type: 'list', label: 'Money: Coins', of: { name: { type: 'text', label: 'Name', max: 12 }, worth: { type: 'int', label: 'Worth', min: 1, max: 1000 } } },
    days: { type: 'int', label: 'Calendar: Days', min: 1, max: 12, help: 'At most 12.' },
    months: { type: 'list', form: 'lines', label: 'Calendar: Months', of: { name: { type: 'text', label: 'Name' }, days: { type: 'int', label: 'Days', min: 1, max: 60 } } },
    connection: { type: 'profile', label: 'Connection' },
    pack: { type: 'text', label: 'Pack', readOnly: true, shows: () => 'From the pack' },
    ghost: { type: 'hologram', label: 'Newer' },
    fancy: { type: 'bool', label: 'Fancy', feature: 'demo.fancy' },
};
export const DEFAULTS = { strict: false, harder: 3, title: 'Lowmere', notes: '', pace: 'steady', prices: 'by-place', budget: 60, coins: [{ name: 'penny', worth: 1 }], days: 7, months: [{ name: 'Frost', days: 30 }], connection: '', pack: 'mine', ghost: 'kept', fancy: false };

export function setup(extra = {}, schema = SCHEMA, defaults = DEFAULTS) {
    const registry = createRegistry();
    const es = {};
    const stored = { m: { settings: { schema, defaults } } };
    const settings = createSettings({ root: () => es, registry: { module: id => stored[id] ?? null }, save: () => {} });
    const parent = doc.createElement('div');
    doc.body.appendChild(parent);
    const changes = [];
    const form = renderSettingsForm(parent, { moduleId: 'm', schema, settings, doc, profiles: () => ({ usable: true, profiles: [{ name: 'Main' }] }), onChange: change => changes.push(change), ...extra });
    return { registry, es, settings, parent, form, changes, saved: () => es.storySuite?.modules?.m ?? {} };
}
export const row = (t, key) => t.form.field(key).row;
export const input = (t, key) => t.form.field(key).handle.input;
export const hasClass = (node, name) => node.classes().includes(name);
