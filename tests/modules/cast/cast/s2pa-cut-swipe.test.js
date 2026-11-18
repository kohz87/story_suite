// S2PA B6: a meeting the reply did not show is taken back on that reply; after a middle delete (the chat's indexes before it move down), a new swipe of that
// reply that does not show the person either must take the meeting back too, never leave them met in a branch that never showed them. Replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';

import { OPENING, castHost, castSource, entry, people, receipts, said, slice } from './helpers.js';

const TEMIWA = entry('temiwa', { name: 'Sister Temiwa', aliases: ['Temiwa', 'Last Candle'], start: { place: 'Harrow', goal: 'tend the dying', routine: 'at the infirmary by day' } });
const LINE = ['~ place Harrow | kind: settlement'];
const met = host => people(host)['ersveil:temiwa'].met;
const notes = host => Object.values(slice(host).notes).filter(item => item.kind === 'met');

test('a middle delete, then a new swipe of the reply that did not show her: she stays unmet (the swipe judges the meeting under the new index)', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await castHost({ source: castSource([TEMIWA]), settings: { pace: 'often' } });
    try {
        await host.send('Hello.', said('Dawn.', OPENING));
        await host.send('We wait.', said('Rain on the roofs.', LINE));
        await host.send('We wait more.', said('Rain, and more rain.', LINE));
        await host.send('Look around.', said('Smoke rises over the yard.', LINE));
        assert.equal(receipts(host, 'cast.meet').length >= 1, true, 'a meeting was planned');
        assert.equal(met(host), null, 'the reply did not show her: taken back');
        const at = host.store.headIndex();
        // A middle exchange ("We wait.") goes, before the reply that carries the next meeting: everything after it moves down by two.
        await host.st.deleteMessage(at - 5);
        await host.st.deleteMessage(at - 5);
        assert.equal(host.store.headIndex(), at - 2);
        assert.equal(met(host), null, 'the replayed reply still takes it back');
        await host.swipe(said('Only smoke, and the rain.', LINE));
        assert.equal(met(host), null, 'a new swipe that never shows her: she is not met in this branch');
        assert.deepEqual(notes(host), [], 'no "Paths crossed" left behind ' + JSON.stringify({ notes: notes(host), meeting: slice(host).meeting, idx: host.store.headIndex() }));
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
        await host.swipe(said('Sister Temiwa kneels by the well.', LINE));
        assert.equal(met(host)?.why, 'place', 'a swipe that shows her keeps the meeting');
        const shown = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), shown, 'rebuild == live');
        await host.st.swipeTo(host.store.headIndex(), 1);
        assert.equal(JSON.stringify(host.head()), live, 'swipe back');
    } finally {
        host.close();
    }
});
