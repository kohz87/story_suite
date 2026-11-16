// {{user}}'s position (`~ you position: …`): parsing, validation, the query's null and the tail line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialScene, validateScene, youParts } from '../../../src/v2/domains/scene.js';
import { YOU_PARTS } from '../../../src/v2/domains/scene/constants.js';
import { sceneQueries } from '../../../src/v2/domains/scene-parts/queries.js';

test('position is a part of the look, with a few other words for it', () => {
    assert.ok(YOU_PARTS.includes('position'));
    assert.deepEqual(youParts('~ you position: kneeling | condition: tired'), { position: 'kneeling', condition: 'tired' });
    assert.deepEqual(youParts('~ you posture: riding | pose: in bed'), { position: 'in bed' });
});

test('scene.you has no position until one is set, then the text', () => {
    const ask = you => sceneQueries['scene.you']({ domains: { scene: { ...initialScene(), ...(you ? { you } : {}) } } }, {}, {});
    assert.equal('position' in ask(), false);
    assert.equal('position' in ask({ wearing: 'a coat' }), false);
    assert.equal('position' in ask({ position: '' }), false);
    assert.equal(ask({ position: 'riding' }).position, 'riding');
});

test('a stored position must be short text', () => {
    const scene = you => ({ ...initialScene(), you });
    assert.deepEqual(validateScene(scene({ position: 'riding' })), []);
    assert.equal(validateScene(scene({ position: 5 })).length, 1);
    assert.equal(validateScene(scene({ position: 'x'.repeat(121) })).length, 1);
});
