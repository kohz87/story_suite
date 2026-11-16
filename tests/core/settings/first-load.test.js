import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleDefaults } from '../../../core/settings/defaults.js';
import { firstLoadSettings } from '../../../core/settings/first-load.js';

const defaults = () => assembleDefaults({
    core: { tailBudget: 1500 },
    modules: [{ moduleId: 'story-block', defaults: { currency: 'gold' } }],
});

test('moves an old-shaped storySuite object whole to storySuite_legacy and builds defaults', () => {
    const old = {
        modules: { 'story-block': { currency: 'silver', chatterMax: 8 } },
        host: { tailBudget: 9999 },
        ui: { next: true },
        features: { 'story-block.rpg': true },
    };
    const extensionSettings = { storySuite: old };
    const settings = firstLoadSettings(extensionSettings, defaults());
    assert.equal(extensionSettings.storySuite_legacy, old);
    assert.equal(settings, extensionSettings.storySuite);
    assert.deepEqual(settings, defaults());
    assert.equal(settings.core.tailBudget, 1500);
    assert.equal(settings.ui.next, false);
    assert.deepEqual(settings.modules['story-block'], { currency: 'gold' });
});

test('a second load changes nothing', () => {
    const extensionSettings = {};
    const first = firstLoadSettings(extensionSettings, defaults());
    first.core.tailBudget = 2000;
    first.modules['story-block'].currency = 'silver';
    const second = firstLoadSettings(extensionSettings, defaults());
    assert.equal(second, first);
    assert.equal(second.core.tailBudget, 2000);
    assert.equal(second.modules['story-block'].currency, 'silver');
    assert.equal(Object.hasOwn(extensionSettings, 'storySuite_legacy'), false);
});
