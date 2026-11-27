// The world card says a happening once: a fact line whose words repeat the same happening's fired line of that day is left off.
import test from 'node:test';
import assert from 'node:assert/strict';

import { dailySummary } from '../../../../modules/world/chronicle/world-daily/summary.js';

const FIRED = 'Every bell in Aurelion stopped mid-peal and shrine flames burned cold and blue.';
const SAID_AGAIN = 'Every bell in Aurelion stops mid-peal and shrine flames burn blue and cold.';
const card = journal => dailySummary({ journal, log: [], warnings: [] });
const fired = { day: 3, text: FIRED, by: 'bells', fired: true };

test('a fact that repeats its happening in another tense and word order is left off', () => {
    assert.equal(card([{ day: 3, text: SAID_AGAIN, by: 'bells' }, fired]), `World: ${FIRED}`);
    assert.equal(card([fired, { day: 3, text: FIRED.toUpperCase().replace('.', '!'), by: 'bells' }]), `World: ${FIRED}`);
});

test('a fact that says something else, belongs to another happening or another day, stays', () => {
    const news = { day: 3, text: 'The Regent has not been seen since the bells of Aurelion stopped.', by: 'bells' };
    assert.equal(card([fired, news]), `World: ${FIRED} ${news.text}`);
    for (const other of [{ day: 3, text: SAID_AGAIN, by: 'omen' }, { day: 4, text: SAID_AGAIN, by: 'bells' }]) assert.equal(card([fired, other]), `World: ${FIRED} ${SAID_AGAIN}`);
    // a short fact inside a long line says less, not the same
    const part = { day: 3, text: 'Shrine flames burned blue.', by: 'bells' };
    assert.equal(card([fired, part]), `World: ${FIRED} ${part.text}`);
});
