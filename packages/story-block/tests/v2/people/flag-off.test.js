// The people part with its flag off changes nothing: no domain, no save-point entry, nothing stored, same prompt and head hash as without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateHash } from '../../../src/v2/timeline/host-block.js';
import { staticParts } from '../../../src/v2/prompt.js';
import { flagOn, FLAGS } from '../../../src/v2/flags.js';
import { createHost } from '../../../testkit/index.js';

// The wired host; `withPart: false` builds one with the part left out (the core's test-only option).
async function peopleHost(t, { on = false, withPart = true } = {}) {
    const host = await createHost({ people: withPart, settings: on ? { flags: { [FLAGS.peopleInStore]: true } } : {} });
    t.after(() => host.close());
    return host;
}
const view = (extra = {}) => ({ v: 1, order: ['a'], npcs: { a: { name: 'Ann', stage: 2 } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1, ...extra });
const sourceOf = host => { const s = host.store.sourceAt(host.store.headIndex()); return { sid: s.sid, swipeKey: s.swipeKey }; };

const REPLY = 'The road.\n<Changes>\n+ item Rope\n</Changes>';

test('flag reads off unless stored true, every time it is asked', () => {
    const root = { storySuite: {} };
    assert.equal(flagOn(root, FLAGS.peopleInStore), false);
    root.storySuite.flags = { 'suite.peopleInStore': 'yes' };
    assert.equal(flagOn(() => root, FLAGS.peopleInStore), false);
    root.storySuite.flags['suite.peopleInStore'] = true;
    assert.equal(flagOn(() => root, FLAGS.peopleInStore), true);
    assert.equal(flagOn(() => { throw new Error('x'); }, FLAGS.peopleInStore), false);
});

test('off: no people domain at the start, after a reply or in a save point; mirror is refused and stores nothing', async t => {
    const host = await peopleHost(t);
    assert.equal(host.head().domains.people, undefined);
    await host.send('Go.', REPLY);
    assert.equal(host.head().domains.people, undefined);
    const before = stateHash(host.head());
    const result = await host.sdk.command('people.mirror', { v: 1, source: sourceOf(host), view: view() });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'OFF');
    assert.equal(host.head().domains.people, undefined);
    assert.equal(stateHash(host.head()), before);
    assert.equal(host.sdk.query('people.mirrorOn'), false);
    assert.equal(host.sdk.query('people.hash'), null);
    assert.doesNotMatch(JSON.stringify(host.ctx.chat), /"people"/);
});

test('off: static prompt and head domains equal a run without the part', async t => {
    const withPart = await peopleHost(t);
    const without = await peopleHost(t, { withPart: false });
    // (a plain reply: coin and item lines mint ids that differ by run)
    for (const host of [withPart, without]) await host.send('Go.', 'The road.');
    const prompt = host => staticParts(host.registry).map(part => part.text).join('\n');
    assert.equal(prompt(withPart), prompt(without));
    // (ids and proofs differ by run, so the domains are compared, not the whole-state hash)
    assert.deepEqual(withPart.head().domains, without.head().domains);
    const keys = host => Object.keys(host.head().domains).filter(name => name !== 'people').sort();
    assert.deepEqual(keys(withPart), keys(without));
});
