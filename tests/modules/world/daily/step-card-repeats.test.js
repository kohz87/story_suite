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
    // words of its own: it has news of its own
    const partly = { day: 3, text: 'Shrine flames burned blue across Highmark Capital.', by: 'bells' };
    assert.equal(card([fired, partly]), `World: ${FIRED} ${partly.text}`);
});

test('a fact the fired line says and then goes on from is left off, irregular past tenses and all', () => {
    const line = { day: 3, text: 'The healing fire of Solenne, the Flame Saintess, goes cold on the night the bells fall silent, and word is that she hides her hands from the court.', by: 'cold', fired: true };
    const fact = { day: 3, text: 'The healing fire of Solenne, the Flame Saintess, went cold on the night the bells fell silent.', by: 'cold' };
    assert.equal(card([fact, line]), `World: ${line.text}`);
});

test('a fact with one word more, or a "never" the fired line lacks, stays', () => {
    // Arsveil's Binders' Market, as the pack words it; and the review's bells
    for (const [event, news] of [
        ['With bound goods failing, a Binders\' Market opens for fresh spirits and caught fairies.', 'A market for fresh spirits and caught fairies opened openly.'],
        ['The shrine bells rang in the lower city at midnight.', 'The shrine bells never rang in the lower city at midnight.'],
    ]) assert.equal(card([{ day: 3, text: event, by: 'one', fired: true }, { day: 3, text: news, by: 'one' }]), `World: ${event} ${news}`);
    const line = { day: 3, text: 'The wardens of the river gate will open it for the grain barges at dawn.', by: 'gate', fired: true };
    for (const word of ['never', 'not']) {
        const denied = { day: 3, text: `The wardens of the river gate will ${word} open it for the grain barges at dawn.`, by: 'gate' };
        assert.equal(card([line, denied]), `World: ${line.text} ${denied.text}`, word);
    }
    // a negation both have is no news
    const both = { day: 3, text: 'The gate stays shut and no barge passes the wardens.', by: 'shut', fired: true };
    assert.equal(card([both, { day: 3, text: 'No barge passes the wardens.', by: 'shut' }]), `World: ${both.text}`);
});
