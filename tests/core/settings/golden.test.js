import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { assembleDefaults } from '../../../core/settings/defaults.js';
import { HOST_SETTINGS_DEFAULTS } from '../../../core/sdk/constants.js';
import { createCoreModule } from '../../../modules/scene/domains/core/module.js';
import { storyDirectorModule } from '../../../ui/legacy/director/module.js';
import { SETTINGS_DEFAULTS as NPC_DEFAULTS } from '../../../modules/people/meters/npc-meters-schema.js';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.endsWith('extensions.js')) {
            return { url: new URL('./extensions-stub.js', import.meta.url).href, shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});

const { DEFAULTS: NSD_RUNTIME_DEFAULTS } = await import('../../../modules/people/settings/runtime-settings-parts/defaults.js');

const GOLDEN_PATH = path.resolve(import.meta.dirname, '..', 'settings-defaults.golden.json');
const WRITE_GOLDEN = process.env.WRITE_GOLDEN === '1';

function ordered(value) {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
    }
    return value;
}

function currentDefaults() {
    const storyBlock = createCoreModule();
    return assembleDefaults({
        core: HOST_SETTINGS_DEFAULTS,
        modules: [
            { moduleId: storyBlock.id, defaults: storyBlock.settings.defaults },
            { moduleId: storyDirectorModule.id, defaults: storyDirectorModule.settings.defaults },
            { moduleId: 'npc-state-delta', defaults: { ...NSD_RUNTIME_DEFAULTS, ...NPC_DEFAULTS } },
        ],
    });
}

test('pins every current settings default from the three packages', () => {
    const actual = ordered(currentDefaults());
    const text = `${JSON.stringify(actual, null, 2)}\n`;
    if (WRITE_GOLDEN) fs.writeFileSync(GOLDEN_PATH, text, 'utf8');
    assert.ok(fs.existsSync(GOLDEN_PATH), `missing ${GOLDEN_PATH}; run with WRITE_GOLDEN=1 to generate`);
    assert.deepEqual(actual, JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')));
    assert.deepEqual(Object.keys(actual.modules), ['npc-state-delta', 'story-block', 'story-director']);
});
