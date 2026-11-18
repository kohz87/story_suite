// SFW6 (W9): the off-screen cast planner's prompts go out with the names filled in, as the arc planner's do; no raw {{user}} / {{char}} macro is sent.
import test from 'node:test';
import assert from 'node:assert/strict';

import { OPENING, castHost, castSource, createFakeModel, entry, said, settle } from './helpers.js';

test('the cast planner call is sent with {{user}} and {{char}} filled in', async t => {
    t.mock.method(console, 'warn', () => {});
    const model = createFakeModel([], { fallback: () => '' });
    const temiwa = entry('temiwa', { name: 'Sister Temiwa', aliases: ['Temiwa'], about: 'A healer.', role: 'Saintess candidate, healer', start: { place: 'Harrow', goal: 'Serve.', routine: 'The infirmary.' } });
    const host = await castHost({ source: castSource([temiwa]), model });
    try {
        await host.send('Hello.', said('Dawn in Harrow.', OPENING));
        await host.send('Is there a healer or a sister around?', said('Nobody answers.'));
        await settle();
        assert.ok(model.calls.length > 0, 'the planner was asked');
        for (const call of model.calls) {
            assert.doesNotMatch(String(call.system), /\{\{(user|char)\}\}/i, 'no raw macro in the system text');
            assert.doesNotMatch(String(call.prompt), /\{\{(user|char)\}\}/i, 'no raw macro in the prompt');
        }
    } finally {
        host.close();
    }
});
