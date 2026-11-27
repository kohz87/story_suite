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
    // under four fifths of its words said already: it has news of its own
    const partly = { day: 3, text: 'Shrine flames burned blue across Highmark Capital.', by: 'bells' };
    assert.equal(card([fired, partly]), `World: ${FIRED} ${partly.text}`);
});

test('a fact the fired line says and then goes on from is left off, irregular past tenses and all', () => {
    const line = { day: 3, text: 'The healing fire of Solenne, the Flame Saintess, goes cold on the night the bells fall silent, and word is that she hides her hands from the court.', by: 'cold', fired: true };
    const fact = { day: 3, text: 'The healing fire of Solenne, the Flame Saintess, went cold on the night the bells fell silent.', by: 'cold' };
    assert.equal(card([fact, line]), `World: ${line.text}`);
});
