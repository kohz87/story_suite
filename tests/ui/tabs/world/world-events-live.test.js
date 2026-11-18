// World events in the World tab on a live host (the real world's daily step, port and selectors): the Conditions here card while the switch is on,
// nothing (and the same view as before) while it is off, and the card follows swipe, a middle delete, a rewind, a reload and a chat change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newHost, reply, FEATURE, SPEC } from '../../../modules/world/daily/daily-host.helpers.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../../ui/select/build.js';
import { worldTab } from '../../../../ui/tabs/world/world.js';
import { installFakeDom } from '../../helpers/dom.js';

// Only the levy: the omen's roll (a chance, over the region) would add a second condition some of the time.
const LEVY = { ...SPEC, events: SPEC.events.filter(event => event.id === 'levy') };
const SETTINGS = { modules: { 'story-director': { 'tracker.maxJump': 60, 'chronicle.tempo': '2' } } };
const portOf = host => createSbPort({ sdk: host.sdk, writes: { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } }, selectors: buildSelectors(() => null, host.sdk) });
const cardOf = host => { installFakeDom(); return worldTab(portOf(host).view('world'), {}).querySelector('[data-card="conditions"]'); };
const play = async host => {
  await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', '~ place Highmark']));
  await host.send('Day.', reply('Dawn.', ['! time +1d']));
  await host.send('Skip.', reply('Later.', ['! time +4d']));
};

test('on: the card names the condition at the party\'s place with its date and what it means; off: no card and no field in the view', async t => {
  const host = await newHost(true, LEVY, SETTINGS);
  t.after(() => host.done());
  await play(host);
  const card = cardOf(host);
  assert.ok(card, 'the Conditions here card is drawn');
  assert.equal(card.querySelector('h3').textContent, 'Conditions here');
  assert.equal(card.querySelector('.cnt').textContent, 'Highmark');
  assert.equal(card.querySelector('.ev .eh b').textContent, 'unrest');
  assert.match(card.querySelector('.meta2').textContent, /since June \d, 1200/);
  assert.equal(card.querySelector('.ev p').textContent, 'Crowds in the streets.');
  assert.match(card.querySelector('.meta2').textContent, /because The lord calls a levy/);
  host.features.set(FEATURE, false);
  assert.equal(cardOf(host), null);
  assert.equal('conditions' in portOf(host).view('world'), false, 'the view-model is the one it was before');
});

test('the card follows a swipe, a middle delete, a rewind, a reload and a chat change (always what the chat holds at Highmark)', async t => {
  const host = await newHost(true, LEVY, SETTINGS);
  t.after(() => host.done());
  await play(host);
  const rows = () => (cardOf(host)?.querySelectorAll('.ev .eh b') ?? []).map(b => b.textContent);
  // The levy fires on a day the chat's seed picks, so the truth is read from the stored conditions, not fixed.
  const held = () => Object.values(host.head().domains.chronicle.conditions ?? {}).filter(entry => entry.ref === 'Highmark').map(entry => entry.name).sort();
  const same = label => assert.deepEqual(rows(), held(), label);
  assert.deepEqual(rows(), ['unrest']);
  await host.swipe(reply('Later, but different.', ['! time +4d']));
  same('swipe');
  await host.swipe(reply('Later.', ['! time +4d']));
  same('swipe back');
  host.store.rebuild();
  same('replay == live');
  for (const [label, line] of [['shrunk', '! time +1h'], ['grown', '! time +9d'], ['edited back', '! time +4d']]) {
    const at = host.ctx.chat.findIndex(message => /^Later/.test(message.mes));
    await host.st.editMessage(at, reply('Later.', [line]));
    assert.equal((await host.sdk.reread(at)).ok, true);
    same(`an edited Re-read, ${label}`);
    host.store.rebuild();
    same(`rebuilt after the ${label} Re-read`);
  }
  await host.st.deleteMessage(host.ctx.chat.findIndex(message => /Dawn\./.test(message.mes)));
  same('a middle delete');
  host.store.rebuild();
  same('rebuilt after it');
  await host.send('More.', reply('Later still.', ['! time +1d']));
  same('sent again');
  const kept = structuredClone(host.ctx.chat);
  while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
  assert.deepEqual(rows(), [], 'rewound: nothing has fired yet');
  await host.st.loadChat(kept);
  same('a reload reads the same');
  await host.st.loadChat(structuredClone(kept.slice(0, 2)));
  assert.deepEqual(rows(), [], 'another chat');
});
