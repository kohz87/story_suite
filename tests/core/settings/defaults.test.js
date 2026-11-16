import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleDefaults } from '../../../core/settings/defaults.js';

test('assembles the schema-1 settings shape with the preview view off', () => {
    const tree = assembleDefaults({
        core: { tailBudget: 1500, callQueue: true },
        modules: [
            { moduleId: 'story-block', defaults: { currency: 'gold', chatterMax: 3 } },
            { id: 'story-director', settings: { defaults: { 'arc.trigger': 'manual' } } },
        ],
    });
    assert.deepEqual(tree, {
        schema: 1,
        core: { tailBudget: 1500, callQueue: true },
        ui: { next: false },
        modules: {
            'story-block': { currency: 'gold', chatterMax: 3 },
            'story-director': { 'arc.trigger': 'manual' },
        },
    });
});

test('copies inputs, keeps an explicit UI value, and refuses duplicate module ids', () => {
    const core = { tailBudget: 1500 };
    const defaults = { currency: 'gold' };
    const tree = assembleDefaults({ core, ui: { next: true }, modules: [{ moduleId: 'story-block', defaults }] });
    tree.core.tailBudget = 2000;
    tree.modules['story-block'].currency = 'silver';
    assert.equal(core.tailBudget, 1500);
    assert.equal(defaults.currency, 'gold');
    assert.equal(tree.ui.next, true);
    assert.throws(
        () => assembleDefaults({ modules: [{ moduleId: 'same', defaults: {} }, { moduleId: 'same', defaults: {} }] }),
        /Two module settings declarations use the id "same"/,
    );
});
