import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { makeMessage } from '../helpers/ui-fake-dom.js';
import { setupDom } from '../../packages/story-block/tests/v2/view/mounts/helpers.js';
import { mountUi } from '../../packages/story-block/src/v2/ui-host.js';
import { fillInput } from '../../packages/story-block/src/v2/extras-ui.js';
import { sceneScreen } from '../../packages/story-block/src/v2/screens/scene.js';
import { renderSkip, show } from '../../packages/story-block/tests/v2/screens/helpers.js';
import { CHATTER_FEATURE, CHOICES_FEATURE, displayLines } from '../../packages/story-block/src/v2/extras.js';
import { BOTH, block, REPLY, lastIndex, extrasOf, fresh } from './extras.helpers.js';

// ---------------------------------------------------------------------------------------------------
// Replay: Re-read, swipes, deletes, a reload

test('Re-read, swipes, a middle delete and a rebuild show the same choices and chatter', async t => {
    const host = await fresh(t);
    await host.send('I look.', REPLY);
    const at = lastIndex(host);
    const before = extrasOf(host, at);
    assert.equal(before.choice.length, 2);
    assert.equal(before.chatter.length, 2);
    // Re-read of the unchanged reply.
    const again = await host.turn.reread(at);
    assert.equal(again.ok, true);
    assert.deepEqual(extrasOf(host, at), before);
    // A swipe has its own lines; swiping back shows the first swipe's again.
    await host.swipe(block('Another take.', ['? choice Go around', '~ chatter Minke: hmm']));
    assert.deepEqual(extrasOf(host, at), { choice: [{ text: 'Go around' }], chatter: [{ name: 'Minke', text: 'hmm' }] });
    await host.st.swipeTo(at, 0);
    assert.deepEqual(extrasOf(host, at), before);
    // A reply after it, then a middle delete: each remaining reply keeps its own.
    await host.send('Next.', block('Next.', ['? choice Sleep']));
    const later = extrasOf(host);
    await host.st.deleteMessage(1);
    await host.st.deleteMessage(1);
    assert.deepEqual(extrasOf(host, at - 2), before);
    assert.deepEqual(extrasOf(host), later);
    // A fresh host over the saved chat (a reload) reads the same.
    const saved = host.ctx.chat;
    const other = await createHost({ settings: BOTH, st: { chat: saved } });
    t.after(() => other.close());
    assert.deepEqual(extrasOf(other, at - 2), before);
});

test('chatter.head: the newest reply\'s chatter as [{ name, text }], read as the strip reads it; null while the feature is off', async t => {
    const host = await fresh(t);
    assert.deepEqual(host.sdk.query('chatter.head'), [], 'a reply without chatter');
    await host.send('I look.', REPLY);
    const want = [{ name: 'Minke', text: '…he\'d better not die down there' }, { name: 'Arn', text: 'keep your head down, boy' }];
    assert.deepEqual(host.sdk.query('chatter.head'), want);
    assert.deepEqual(host.sdk.query('chatter.head'), extrasOf(host).chatter, 'the same lines the strip under the reply shows');
    // A swipe shows its own; swiping back, the first one's again; a delete of the newest falls back a reply.
    const at = lastIndex(host);
    await host.swipe(block('Another take.', ['~ chatter Minke: hmm']));
    assert.deepEqual(host.sdk.query('chatter.head'), [{ name: 'Minke', text: 'hmm' }]);
    await host.st.swipeTo(at, 0);
    assert.deepEqual(host.sdk.query('chatter.head'), want);
    await host.send('Next.', block('Next.', ['~ chatter Arn: quiet now']));
    assert.deepEqual(host.sdk.query('chatter.head'), [{ name: 'Arn', text: 'quiet now' }]);
    // The reader's own message after it: still the newest reply's (the one being answered).
    host.ctx.chat.push({ name: 'You', is_user: true, mes: 'And then?' });
    assert.deepEqual(host.sdk.query('chatter.head'), [{ name: 'Arn', text: 'quiet now' }]);
    host.ctx.chat.pop();
    await host.st.deleteMessage(lastIndex(host));
    await host.st.deleteMessage(lastIndex(host));
    assert.deepEqual(host.sdk.query('chatter.head'), want, 'after deleting the newest exchange, the reply before it');
    // Off: null, as every query of a feature that is off.
    host.features.set(CHATTER_FEATURE, false);
    assert.equal(host.sdk.query('chatter.head'), null);
});

test('scene.moved: true only while the head reply moved the place; a swipe, a later reply and a delete follow', async t => {
    const host = await fresh(t);
    assert.equal(host.sdk.query('scene.moved'), false, 'no place line yet');
    await host.send('We go.', block('The gate.', ['~ place Watch Granary | kind: settlement | region: Bluewatch']));
    assert.equal(host.sdk.query('scene.moved'), true);
    const at = lastIndex(host);
    await host.swipe(block('We stay.', ['~ chatter Minke: hmm']));
    assert.equal(host.sdk.query('scene.moved'), false, 'the swipe that stays');
    await host.st.swipeTo(at, 0);
    assert.equal(host.sdk.query('scene.moved'), true);
    await host.send('Look around.', block('The same yard.', ['~ place Watch Granary | region: Bluewatch']));
    assert.equal(host.sdk.query('scene.moved'), false, 'the same place described again is no move');
    await host.st.deleteMessage(lastIndex(host));
    await host.st.deleteMessage(lastIndex(host));
    assert.equal(host.sdk.query('scene.moved'), true, 'after a delete, the reply before it again');
});

// ---------------------------------------------------------------------------------------------------
// Never sent back, unless the reader asks

test('chatter never reaches a later prompt by default; with the setting, the answered reply\'s thoughts go as one tail line', async t => {
    const host = await fresh(t);
    await host.send('I look.', REPLY);
    await host.send('I climb.', 'You climb.');
    const sent = JSON.stringify(host.st.requests.at(-1));
    assert.doesNotMatch(sent, /better not die/, 'not in the history (the block is stripped) nor the tail');
    host.settings.set('story-block', 'chatterInPrompt', true);
    await host.send('Back down.', block('Down.', ['~ chatter Arn: finally']));
    // The reply this message answered ("You climb.") had no chatter: nothing.
    assert.doesNotMatch(JSON.stringify(host.st.requests.at(-1)), /Inner chatter last reply/);
    await host.send('And?', 'Silence.');
    const tail = host.st.requests.at(-1).chat.filter(message => message.role === 'system').map(message => message.content).join('\n');
    assert.match(tail, /\[Inner chatter last reply, unspoken: only the thinker knows\] Arn: finally/);
    // A swipe of the newest reply uses the reply before it (the one the reader answered), not itself.
    await host.swipe(block('Silence again.', ['~ chatter Minke: never this one']));
    await host.swipe('Third.');
    const swiped = JSON.stringify(host.st.requests.at(-1));
    assert.match(swiped, /Arn: finally/);
    assert.doesNotMatch(swiped, /never this one/);
    // The static part did not move with the setting.
    host.settings.set('story-block', 'chatterInPrompt', false);
    await host.send('Hm.', 'Ok.');
    assert.doesNotMatch(JSON.stringify(host.st.requests.at(-1)), /Inner chatter last reply/);
});

// ---------------------------------------------------------------------------------------------------
// The page: buttons that only fill the box, the folded strip, the dossier chip

async function page(t, { settings = BOTH, modules = [] } = {}) {
    t.mock.method(console, 'warn', () => {});
    const doc = setupDom();
    const box = doc.createElement('textarea');
    box.id = 'send_textarea';
    box.value = '';
    box.events = [];
    box.dispatchEvent = event => box.events.push(event.type);
    doc.body.appendChild(box);
    const send = doc.createElement('div');
    send.id = 'send_but';
    send.clicks = 0;
    send.addEventListener('click', () => { send.clicks += 1; });
    doc.body.appendChild(send);
    const host = await createHost({ settings, modules });
    t.after(() => host.close());
    const runtime = { registry: host.registry, store: host.store, sdk: host.sdk, settings: host.settings, events: host.events, turn: host.turn };
    const ui = mountUi({ runtime, ctx: host.ctx, doc, version: '2.0.0-test' });
    t.after(() => ui.destroy());
    const draw = () => {
        for (const old of doc.querySelectorAll('.mes')) old.remove();
        host.ctx.chat.forEach((message, index) => makeMessage(doc, index));
        ui.extras.refreshAll();
    };
    const at = (index, selector) => doc.querySelector(`.mes[mesid="${index}"] ${selector}`);
    return { doc, host, ui, draw, at, box, send };
}

test('the latest reply\'s choices are buttons; a click fills the message box and sends nothing', async t => {
    const { host, draw, at, box, send } = await page(t);
    await host.send('Hello.', 'The road.');
    await host.send('I look.', block('The wall.', ['? choice Climb the wall', '? choice <img src=x onerror=alert(1)>']));
    draw();
    const index = lastIndex(host);
    const buttons = [...(at(index, '.story-suite-choices')?.querySelectorAll('.story-suite-choice') ?? [])];
    assert.deepEqual(buttons.map(node => node.textContent), ['Climb the wall', '<img src=x onerror=alert(1)>']);
    assert.equal(at(index, 'img'), null, 'markup from the story never becomes an element');
    const length = host.ctx.chat.length;
    const requests = host.st.requests.length;
    box.value = 'Carefully,';
    buttons[0].click();
    assert.equal(box.value, 'Carefully, Climb the wall', 'after what the reader typed');
    assert.deepEqual(box.events, ['input']);
    assert.equal(send.clicks, 0, 'Send was not pressed');
    assert.equal(host.ctx.chat.length, length, 'no message was added');
    assert.equal(host.st.requests.length, requests, 'nothing was generated');
    // An earlier reply shows no buttons; once the reader answers, the choices go.
    assert.equal(at(index - 2, '.story-suite-choices'), null);
    await host.send('Climb the wall', 'You climb.');
    draw();
    assert.equal(at(index, '.story-suite-choices'), null);
    assert.equal(fillInput('x', { document: { querySelector: () => null } }), 'unavailable');
});

test('no Inner chatter strip is drawn under replies; the choices stay', async t => {
    const opened = [];
    const nsd = {
        id: 'npc-state-delta', name: 'NPC State Delta', version: '0.0.1',
        queries: { 'npc.dossier': (state, args) => (String(args?.name).toLowerCase() === 'minke' ? { name: 'Minke' } : null) },
    };
    const previous = globalThis.NPCStateDelta;
    globalThis.NPCStateDelta = { openDossier: name => { opened.push(name); return true; } };
    t.after(() => { globalThis.NPCStateDelta = previous; });
    const { host, draw, at, doc } = await page(t, { modules: [nsd] });
    await host.send('Hello.', REPLY);
    await host.send('Next.', block('Later.', ['? choice Wait', '~ chatter Minke: <b>still</b> here']));
    draw();
    for (const index of [2, 4]) assert.equal(at(index, '.story-suite-chatter'), null, `reply ${index} has no chatter strip`);
    for (const part of ['.story-suite-chatter', '.story-suite-chatter-head', '.story-suite-chatter-name', '.story-suite-chatter-dossier']) {
        assert.equal(doc.querySelectorAll(part).length, 0, `no ${part} anywhere`);
    }
    assert.deepEqual([...at(4, '.story-suite-choices').querySelectorAll('.story-suite-choice')].map(node => node.textContent), ['Wait']);
    assert.doesNotMatch(at(4, '.story-suite-extras').textContent, /still|Minke/);
    // The chatter is still read and kept for the World screen (chatter.head) and the setting's tail line.
    assert.deepEqual(host.sdk.query('chatter.head'), [{ name: 'Minke', text: '<b>still</b> here' }]);
    assert.deepEqual(opened, []);
});

test('turning Choices off takes the buttons away at once; Inner chatter draws nothing under replies either way', async t => {
    const { host, draw, at } = await page(t);
    await host.send('Hello.', REPLY);
    draw();
    assert.ok(at(2, '.story-suite-choices'));
    host.features.set(CHOICES_FEATURE, false);
    assert.equal(at(2, '.story-suite-extras'), null);
    host.features.set(CHATTER_FEATURE, false);
    host.features.set(CHOICES_FEATURE, true);
    assert.ok(at(2, '.story-suite-choices'));
    assert.equal(at(2, '.story-suite-chatter'), null);
});

// ---------------------------------------------------------------------------------------------------
// The Scene screen shows each present person's thought while Story Director's World is not there (#142)

const WORLD = {
    id: 'story-director', name: 'Story Director', version: '0.0.1',
    features: [{ id: 'story-director.world', label: 'World view', describe: 'The World screen.', default: true }],
    screens: [{ id: 'story-director/world', title: 'World', mounts: ['tab', 'screen'], template: '<p>world</p>', feature: 'story-director.world' }],
};

test('Scene without Story Director: under each person present, their thought (the name, then the thought)', { skip: renderSkip }, async t => {
    const host = await fresh(t);
    await host.send('We go in.', block('Minke and Arn wait by the gate.', [
        '+ present Minke', '+ present Arn', '~ chatter minke: …he\'d better not die', '~ chatter Stranger: who are they', '~ chatter Minke: hurry',
    ]));
    // One thought each, the last line a thinker wrote, matched to the scene's name ignoring case; a thinker
    // who is not present is left out.
    assert.deepEqual(host.sdk.query('scene.chatter'), [{ name: 'Minke', text: 'hurry' }]);
    const { el, view } = show(sceneScreen, { state: host.head(), query: (name, args) => host.sdk.query(name, args) });
    assert.deepEqual(view.warnings, []);
    assert.deepEqual(el.querySelectorAll('.who').map(node => [node.querySelector('.name').textContent, node.querySelectorAll('.thought').map(item => item.textContent)]), [['Minke', ['hurry']], ['Arn', []]]);
    assert.equal(el.querySelectorAll('b').length, 0);
    // A swipe without chatter: nothing under anyone.
    await host.swipe(block('They wait.', ['+ present Minke', '+ present Arn']));
    assert.deepEqual(host.sdk.query('scene.chatter'), []);
    // Off: null, and the screen draws no thought.
    await host.st.swipeTo(lastIndex(host), 0);
    assert.equal(host.sdk.query('scene.chatter').length, 1);
    host.features.set(CHATTER_FEATURE, false);
    assert.equal(host.sdk.query('scene.chatter'), null);
    assert.equal(show(sceneScreen, { state: host.head(), query: (name, args) => host.sdk.query(name, args) }).el.querySelectorAll('.thought').length, 0);
});

test('Scene with Story Director\'s World registered: no thoughts there (World → Now shows them); World off: back on Scene', { skip: renderSkip }, async t => {
    const host = await fresh(t, BOTH, [WORLD]);
    await host.send('We go in.', block('Minke waits.', ['+ present Minke', '~ chatter Minke: hurry']));
    assert.deepEqual(host.sdk.query('chatter.head'), [{ name: 'Minke', text: 'hurry' }], 'World reads chatter.head');
    assert.deepEqual(host.sdk.query('scene.chatter'), []);
    assert.equal(show(sceneScreen, { state: host.head(), query: (name, args) => host.sdk.query(name, args) }).el.querySelectorAll('.thought').length, 0);
    host.features.set('story-director.world', false);
    assert.deepEqual(host.sdk.query('scene.chatter'), [{ name: 'Minke', text: 'hurry' }], 'World off: chatter has nowhere else to show');
});

test('a marked ^ reply: its choices and chatter are drawn (caret), an unmarked one is not', async t => {
    const host = await fresh(t);
    const text = block('The wall rose.', ['^? ^choice ^Climb ^the ^wall', '^~ ^chatter ^Minke: ^careful']);
    await host.send('Go.', text);
    const at = lastIndex(host), entryOf = word => host.registry.capture(word);
    assert.ok(host.ctx.chat[at].extra.storySuite.rules.includes('caretWords'), 'the reply carries the mark');
    assert.deepEqual(displayLines(text, { entryOf }), {}, 'without the mark: not read');
    const read = displayLines(text, { entryOf, caret: true });
    assert.equal(read.choice?.[0]?.text, 'Climb the wall');
    assert.ok(read.chatter?.length === 1, JSON.stringify(read));
    // The wiring: the next prompt's tail carries the marked reply's chatter (runtime display reads the reply's mark).
    host.settings.set('story-block', 'chatterInPrompt', true);
    await host.send('Next.', 'Calm.');
    const tail = host.st.requests.at(-1).chat.filter(message => message.role === 'system').map(message => message.content).join('\n');
    assert.match(tail, /Inner chatter last reply, unspoken: only the thinker knows\] Minke: careful/);
});

test('a marked ^ reply: its chatter is shown on chatter.head and scene.chatter, an unmarked ^ reply shows none', async t => {
    const host = await fresh(t);
    await host.send('Go.', block('Minke waited.', ['+ present Minke', '^~ ^chatter ^Minke: ^careful']));
    assert.deepEqual(host.sdk.query('chatter.head'), [{ name: 'Minke', text: 'careful' }]);
    assert.deepEqual(host.sdk.query('scene.chatter'), [{ name: 'Minke', text: 'careful' }]);
    const at = lastIndex(host);
    delete host.ctx.chat[at].extra.storySuite;   // the same text without its record: no mark, so the ^ lines are not read
    assert.deepEqual(host.sdk.query('chatter.head'), []);
});
