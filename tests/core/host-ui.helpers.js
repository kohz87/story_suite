import { installFakeDom } from '../helpers/ui-fake-dom.js';
import { createRegistry } from '../../core/registry.js';
import { createSettings } from '../../core/sdk.js';

export const doc = installFakeDom();

export function setup(...defs) {
    const registry = createRegistry();
    for (const def of defs) registry.register(def);
    const es = {};
    let saves = 0;
    const settings = createSettings({ root: () => es, registry, save: () => { saves += 1; } });
    return { registry, es, settings, saves: () => saves };
}

export const rpg = () => ({
    id: 'rpg-battle',
    name: 'RPG Battle',
    settings: {
        defaults: { hardMode: false, level: 5, pace: 'normal', title: 'Hero', coins: [{ name: 'silver', rate: 10 }] },
        schema: {
            hardMode: { type: 'bool', label: 'Hard mode', help: 'Foes hit harder.' },
            level: { type: 'int', min: 1, max: 30 },
            pace: ['slow', 'normal', { value: 'fast', label: 'Fast!' }],
            title: 'text',
            coins: { type: 'list', of: { name: 'text', rate: { type: 'int', min: 1 } } },
        },
    },
});
export const row = (root, module, key) => root.querySelectorAll('details.story-suite-fold')
    .find(fold => fold.dataset.fold === module).querySelector(`.story-suite-row[data-field="${key}"]`);
export const change = node => node.dispatch('change');

export const topFolds = root => root.children.filter(node => node.classList.contains('story-suite-fold'));
export const subFolds = fold => fold.querySelector('.story-suite-fold-body').children.filter(node => node.classList.contains('story-suite-subfold'));
export const foldAt = (root, key) => root.querySelectorAll('details.story-suite-fold, details.story-suite-subfold').find(node => node.dataset.fold === key);

// Story Director's settings as its module.js flattens them (labels "Calendar: …"), plus a `group` field.
export const director = () => ({
    id: 'story-director',
    name: 'Story Director',
    settings: {
        defaults: { 'tracker.calendar.months': [{ name: 'January', days: 31 }, { name: 'February', days: 28 }] },
        schema: {
            'tracker.calendar.preset': { type: 'choice', label: 'Calendar: Calendar', options: ['pack', 'gregorian'] },
            'tracker.calendar.era': { type: 'text', label: 'Calendar: Era (written before the year)' },
            'tracker.calendar.months': { type: 'list', label: 'Calendar: Months', of: { name: { type: 'text', label: 'Name' }, days: { type: 'int', label: 'Days', min: 1, max: 400 } } },
            'tracker.dormantReplies': { type: 'int', label: 'Quiet after replies', min: 1, max: 500 },
            'quests.offerCooldown': { type: 'int', label: 'Replies between offers', group: 'Quests' },
            'money.scale': { type: 'text', label: 'Money scale (0: the pack\'s)' },
        },
    },
});

export const MONTHS = { type: 'list', label: 'Months', of: { name: { type: 'text', label: 'Name' }, days: { type: 'int', label: 'Days', min: 1, max: 400 } } };

// Story Director's months with `form: 'lines'`, as its schema sets it.
export const linesDirector = () => {
    const def = director();
    def.settings.schema['tracker.calendar.months'] = { ...def.settings.schema['tracker.calendar.months'], form: 'lines' };
    return def;
};
