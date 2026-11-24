// FU134: sought from a spot the story named in town. The party at "Harrow", then `~ place Harrow Storehouse | kind: settlement`: the spot is filed
// inside Harrow, so the people of Harrow are at the party's place (no nameless rumor).
import test from 'node:test';
import assert from 'node:assert/strict';

import { OPENING, castHost, castSource, createFakeModel, entry, people, receipts, said, settle } from './helpers.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
const inPack = ({ fields, ...own }) => ({ ...own, role: fields.Calling });
const temiwa = place => entry('temiwa', {
    name: 'Sister Temiwa', aliases: ['Temiwa', 'Last Candle'],
    about: 'A fox-eared saintess candidate cast out to the frontier: its sarcastic healer and the keeper of its dead.',
    fields: { Calling: 'Saintess candidate, healer' },
    start: { place, goal: 'Serve out the posting.', routine: 'Watchhouse infirmary by day; the yard at night.' },
});
const planner = sought => createFakeModel([], { fallback: call => (/People who might fit/.test(call.prompt) ? sought(call) : '') });
const ASK = 'Is there a healer or a sister around?';

test('FU134: sought from a spot the story named in town (a "settlement" kind written for it): she is at the party\'s place, so she comes in and no rumor goes out', async t => {
    quiet(t);
    const model = planner(() => '? cast temiwa | "a healer or a sister"');
    const host = await castHost({ source: castSource([inPack(temiwa('Harrow'))]), model });
    try {
        await host.send('Hello.', said('Dawn in Harrow.', OPENING));
        await host.send('We go to the granary.', said('The storehouse.', ['~ place Harrow Storehouse | kind: settlement']));
        assert.equal(host.head().domains.scene.place.name, 'Harrow / Harrow Storehouse');
        assert.equal(host.head().domains.scene.place.kind, 'building');
        await host.send(ASK, said('Nobody answers.'));
        await settle();
        await host.send('I look around.', said(`Sister Temiwa looks up. ${host.everyone()}`));
        assert.equal(people(host)['ersveil:temiwa'].met.why, 'sought');
        assert.equal(receipts(host, 'cast.rumor').length, 0, 'no nameless rumor');
    } finally {
        host.close();
    }
});
