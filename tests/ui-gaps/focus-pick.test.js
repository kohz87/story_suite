// Director data (G8): the quest the reader picks as the focus is kept with the chat's view prefs; the Journal and Now › Today read it; a swipe, middle delete, rewind, reload, Re-read and a chat change agree with live; no pick (or a closed quest) gives today's director.goal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createModule } from '../../modules/director/module.js';
import { withD1 } from '../helpers/director/d1.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { chatPrefs } from '../../ui/port/st-chat.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const TOLD = [
  ['~ time June 3, 1200, 08:00 am', '+ quest Wolf pelts — thin the pack | goal: thin the wolves | step: ask at the lodge'],
  ['+ quest Missing boatman | goal: find Hal | step: reach Auvoth'],
];

async function told(t, chatMetadata = {}, chat = null, lists = TOLD) {
  t.mock.method(console, 'warn', () => {});
  let host = null;
  const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
  host = await createHost({ modules: [director], st: { chatMetadata, ...(chat ? { chat } : {}) } });
  t.after(() => host.close());
  if (!chat) for (const [i, lines] of lists.entries()) await host.send(`Go ${i}.`, said(`Reply ${i}.`, lines));
  return host;
}
const portOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk), prefs: { chat: chatPrefs(() => host.ctx) } });
const idOf = (host, key) => host.sdk.query('director.threads', {}).find(row => row.key === key).id;
const seen = host => { const port = portOf(host); return { journal: port.view('journal').focusId, first: port.view('journal').quests[0]?.title, now: port.view('now').today.focus?.title }; };

test('no pick: the focus is director.goal (the newest quest); a pick moves it on the Journal and on Now', async t => {
  const host = await told(t);
  const port = portOf(host);
  assert.equal(port.can('quest.focus'), true);
  assert.deepEqual(seen(host), { journal: idOf(host, 'Missing boatman'), first: 'Missing boatman', now: 'find Hal' });
  const answer = await port.command('quest.focus', { id: idOf(host, 'Wolf pelts') });
  assert.equal(answer.ok, true);
  assert.deepEqual(seen(host), { journal: idOf(host, 'Wolf pelts'), first: 'Wolf pelts', now: 'thin the wolves' });
  assert.equal(host.ctx.chatMetadata.storySuiteUiPrefs.focusQuest, idOf(host, 'Wolf pelts'));
  await port.command('quest.focus', { id: '' });
  assert.equal(seen(host).first, 'Missing boatman', 'an empty pick clears it');
});

test('the pick outlasts a swipe, a Re-read (edited too) and a reload, and is per chat', async t => {
  const host = await told(t);
  const port = portOf(host);
  const pick = idOf(host, 'Wolf pelts');
  await port.command('quest.focus', { id: pick });
  await host.swipe(said('Another.', ['+ quest Missing boatman | goal: find Hal | step: reach Auvoth']));
  assert.equal(seen(host).journal, pick, 'swipe');
  await host.swipe(said('Reply 1.', TOLD[1]));
  assert.equal(seen(host).journal, pick, 'swipe back');
  const head = host.ctx.chat.length - 1;
  await host.st.editMessage(head, host.ctx.chat[head].mes.replace('step: reach Auvoth', 'step: reach Auvoth | reward: 5 gold'));
  assert.equal((await host.sdk.reread(head)).ok, true);
  assert.equal(seen(host).journal, pick, 'edited Re-read');
  await host.store.flush();
  const loaded = await told(t, structuredClone(host.ctx.chatMetadata), structuredClone(host.ctx.chat));
  assert.equal(idOf(loaded, 'Wolf pelts'), pick);
  assert.equal(seen(loaded).journal, pick, 'reload');
  const other = await told(t);
  assert.equal(seen(other).first, 'Missing boatman', 'a chat with no pick of its own');
});

test('a pick for a quest that is gone (a rewind or a middle delete took it) falls back to director.goal', async t => {
  const host = await told(t);
  await portOf(host).command('quest.focus', { id: idOf(host, 'Missing boatman') });
  assert.equal(seen(host).now, 'find Hal');
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  assert.deepEqual(seen(host), { journal: idOf(host, 'Wolf pelts'), first: 'Wolf pelts', now: 'thin the wolves' }, 'rewind');
  const mid = await told(t);
  await portOf(mid).command('quest.focus', { id: idOf(mid, 'Wolf pelts') });
  await mid.st.deleteMessage(1);
  await mid.st.deleteMessage(1);
  assert.equal(mid.sdk.query('director.threads', {}).some(row => row.key === 'Wolf pelts'), false);
  assert.equal(seen(mid).first, 'Missing boatman', 'a middle delete');
});

test('without chat prefs the command fails cleanly and the selector still answers', async t => {
  const host = await told(t);
  const port = createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) });
  const answer = await port.command('quest.focus', { id: idOf(host, 'Wolf pelts') });
  assert.equal(answer.ok, false);
  assert.equal(port.view('journal').quests[0].title, 'Missing boatman');
});
