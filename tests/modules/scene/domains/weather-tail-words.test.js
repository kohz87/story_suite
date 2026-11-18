// SFW6 (W24): the weather on the Place line is cut at a whole word, never in the middle of one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneTail } from '../../../../modules/scene/index.js';

const lineFor = text => sceneTail({ domains: { scene: { place: { name: 'Bluewatch' }, weather: { text } } } }, { weather: true })[0];

test('a long weather text ends on a whole word; a short one is kept as it is', () => {
    assert.equal(lineFor('first snow, thin and drifting'), 'Place: Bluewatch; first snow, thin and…');
    assert.equal(lineFor('heavy snow settling over the city'), 'Place: Bluewatch; heavy snow settling over…');
    assert.equal(lineFor('clear and cold'), 'Place: Bluewatch; clear and cold');
});
