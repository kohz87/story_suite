// The `persona.portrait` query (core/persona-portrait.js): the reader's persona picture as a safe URL, else null; a read of the live context, never stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { personaPortrait } from '../../core/persona-portrait.js';

async function fresh(t) {
    const host = await createHost();
    t.after(() => host.close());
    return host;
}

test('persona.portrait answers the avatar file as a /User%20Avatars URL', async t => {
    const host = await fresh(t);
    Object.assign(host.ctx, { name1: 'Astra', user_avatar: 'astra face.png' });
    assert.equal(host.sdk.query('persona.portrait'), '/User%20Avatars/astra%20face.png');
});

test('persona.portrait finds the avatar by the persona\'s name when the context names none, and only when one avatar has that name', async t => {
    const host = await fresh(t);
    Object.assign(host.ctx, { name1: 'Astra', user_avatar: '', powerUserSettings: { personas: { 'a.png': 'Astra', 'b.png': 'Bram' } } });
    assert.equal(host.sdk.query('persona.portrait'), '/User%20Avatars/a.png');
    host.ctx.powerUserSettings.personas['c.png'] = 'Astra';
    assert.equal(host.sdk.query('persona.portrait'), null);
});

test('persona.portrait is null with no persona or no avatar', async t => {
    const host = await fresh(t);
    Object.assign(host.ctx, { name1: '', user_avatar: '', powerUserSettings: { personas: {} } });
    assert.equal(host.sdk.query('persona.portrait'), null);
    host.ctx.name1 = 'Astra';
    assert.equal(host.sdk.query('persona.portrait'), null);
});

test('persona.portrait is not stored: asking it leaves the state as it was', async t => {
    const host = await fresh(t);
    Object.assign(host.ctx, { name1: 'Astra', user_avatar: 'a.png' });
    const before = JSON.stringify(host.store.head());
    host.sdk.query('persona.portrait');
    assert.equal(JSON.stringify(host.store.head()), before);
});

test('personaPortrait refuses a URL that could break out of a CSS url() and never throws', () => {
    // encodeURIComponent leaves ( and ) alone, which the check refuses; a context that throws is null.
    assert.equal(personaPortrait({ user_avatar: 'x(evil).png' }), null);
    assert.equal(personaPortrait({ user_avatar: 'ok.png' }), '/User%20Avatars/ok.png');
    assert.equal(personaPortrait({ get user_avatar() { throw new Error('no'); } }), null);
    assert.equal(personaPortrait(null), null);
});
