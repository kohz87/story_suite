// The Models page's roles: connectionFor(role), the `role` on a model call, and the profile list's notes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionFor, ROLE_SETTING } from '../../core/model-call/connection-for.js';
import { createModelCalls } from '../../core/model-call.js';
import { profileChoices } from '../../core/model-call/profile-field.js';
import { HOST_SETTINGS_DEFAULTS, HOST_SETTINGS_SCHEMA } from '../../core/sdk.js';

const quiet = { log: () => {} };

test('the three roles resolve: Story is always the chat\'s, Quick and Background read their own setting', () => {
    const host = { quickConnection: 'Fast', backgroundConnection: ' Slow ' };
    assert.deepEqual(['story', 'quick', 'background'].map(role => connectionFor(role, host)), ['', 'Fast', 'Slow']);
    assert.equal(connectionFor('story', { quickConnection: 'Fast' }), '');
    assert.equal(connectionFor('nope', host), '');
    assert.equal(connectionFor('quick', null), '');
    assert.equal(connectionFor('quick', { quickConnection: 'chat' }), '', '"chat" is Same as chat');
});

test('the two roles are host settings: profile fields, "Same as chat" by default', () => {
    for (const key of Object.values(ROLE_SETTING)) {
        assert.equal(HOST_SETTINGS_SCHEMA[key].type, 'profile');
        assert.equal(HOST_SETTINGS_DEFAULTS[key], '');
    }
});

test('a call with a role goes through that role\'s profile; an explicit profile still wins; no role is the chat\'s', async () => {
    const host = { quickConnection: 'Fast', backgroundConnection: 'Slow' };
    const seen = [];
    const { callModel } = createModelCalls({ ...quiet, roleProfile: role => connectionFor(role, host), call: async (prompt, options) => { seen.push(options.profile); return 'ok'; } });
    await callModel({ prompt: 'a', role: 'quick', module: 'm1' });
    await callModel({ prompt: 'b', role: 'background', module: 'm2' });
    await callModel({ prompt: 'c', role: 'story', module: 'm3' });
    await callModel({ prompt: 'd', role: 'quick', profile: 'Mine', module: 'm4' });
    await callModel({ prompt: 'e', module: 'm5' });
    assert.deepEqual(seen, ['Fast', 'Slow', '', 'Mine', '']);
});

test('a role whose setting changes is read again on the next call (no value is kept)', async () => {
    const host = { quickConnection: 'Fast' };
    const seen = [];
    const { callModel } = createModelCalls({ ...quiet, roleProfile: role => connectionFor(role, host), call: async (prompt, options) => { seen.push(options.profile); return 'ok'; } });
    await callModel({ prompt: 'a', role: 'quick', module: 'm' });
    host.quickConnection = '';
    await callModel({ prompt: 'b', role: 'quick', module: 'm' });
    assert.deepEqual(seen, ['Fast', '']);
});

test('Same as chat is the first option; a stored profile that is gone stays, with the existing warning', () => {
    const list = { usable: true, why: '', profiles: [{ id: 'p1', name: 'Cheap' }] };
    assert.deepEqual(profileChoices('', list).options.map(o => o.label), ['Same as chat', 'Cheap']);
    const gone = profileChoices('Old one', list);
    assert.equal(gone.selected, 'Old one');
    assert.match(gone.note, /not in the Connection Manager any more/);
    assert.match(profileChoices('', { usable: true, profiles: [] }).note, /no connection profiles yet/);
});
