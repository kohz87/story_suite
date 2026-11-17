// The world line's conditions (job D) on the real host, through the real store (job A): no stubbed commands or names.
// A reply's `| conditions:` label sets and lifts the pack's conditions; a second world line in a reply is refused; replay == live.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const FEATURE = 'story-director.world-events';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PACK = JSON.stringify({
    id: 'world-line', version: '1.0.0', name: 'World line', requires: { storyBlock: '^2' },
    content: {
        places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0 }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5 }],
        conditions: [
            { name: 'grain-dear', scope: 'region', fades: '10 days', means: 'Bread costs more.' },
            { name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' },
        ],
    },
});

export async function newHost(on) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}
const keys = host => Object.keys(host.head().domains.chronicle.conditions ?? {}).sort();
const summaries = host => host.sdk.receipts().map(entry => String(entry.receipt.summary ?? '')).join('\n');

async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await createHost({ modules: [fakeFightRunner(), createModule()] });
    try {
        again.features.set(FEATURE, true);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains.chronicle), JSON.stringify(host.head().domains.chronicle), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}

const RIOT = '+ world Bread Riots — crowds fill the square | state: ongoing | place: Highmark | conditions: +unrest, +grain-dear';
// A second line WITH conditions in the same reply is refused (seam audit E38: the cap counts only lines with `conditions:`).
const SECOND = '+ world Second Thing — another line | state: looming | place: Bluewatch | conditions: +unrest';
const PLAIN = '+ world Third Thing — a plain line | state: looming | place: Bluewatch';

test('on the host: a world line sets the pack\'s conditions through the real commands; a second line in the reply is refused', async () => {
    const host = await newHost(true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT, SECOND]));
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark'], 'region from the place on the line; place as is');
    const unrest = host.head().domains.chronicle.conditions['unrest@Highmark'];
    assert.equal(unrest.by, 'narrator');
    assert.equal(unrest.scope, 'place');
    assert.ok(host.sdk.query('chronicle.conditions', { ref: 'highmark' }).some(row => row.name === 'unrest'));
    assert.equal('Second Thing' in Object.fromEntries(Object.values(host.head().domains.chronicle.events).map(e => [e.name, 1])), false, 'the second world line is refused');
    assert.match(summaries(host), /Conditions: \+unrest \(Highmark\)/);
    await agrees(host, 'live');
    // A world line without conditions is not capped: it stands beside the one with conditions.
    await host.send('Listen.', reply('Talk of the gate.', ['+ world Gate Talk — the gate | state: looming | place: Highmark | conditions: +unrest', PLAIN]));
    assert.ok(Object.values(host.head().domains.chronicle.events).some(event => event.name === 'Third Thing'), 'a plain second line stands');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    // Lift one in a later reply.
    await host.send('Calm.', reply('The crowds go home.', ['+ world Bread Riots — the crowds go home | state: over | place: Highmark | conditions: -unrest']));
    assert.deepEqual(keys(host), ['grain-dear@The March']);
    await agrees(host, 'lifted');
    // Swipe the lift and back, an edited Re-read (shrunk: no conditions; grown: both lines), a middle delete, a rewind.
    await host.swipe(reply('Still crowds.'));
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark']);
    await agrees(host, 'swipe');
    const at = host.ctx.chat.findIndex(message => /The square fills\./.test(message.mes));
    await host.st.editMessage(at, reply('The square fills.', ['+ world Bread Riots — crowds | state: ongoing | place: Highmark']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(keys(host), [], 'shrunk Re-read: the label gone, nothing set');
    await agrees(host, 'shrunk Re-read');
    await host.st.editMessage(at, reply('The square fills.', [RIOT, SECOND]));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark'], 'grown Re-read: set again, the second line refused again');
    await agrees(host, 'grown Re-read');
    await host.st.deleteMessage(at);
    assert.deepEqual(keys(host), []);
    await agrees(host, 'middle delete');
    assert.deepEqual(host.store.problems(), []);
    host.close();
});

test('on the host, switch off: a Re-read while the threads feature is off runs the plain world line (both lines kept, no worldLine mark)', async () => {
    const host = await newHost(false);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT, SECOND]));
    const at = host.ctx.chat.findIndex(message => /The square fills\./.test(message.mes));
    // With the threads feature off a Re-read runs the world lines "again", where every declared feature reads on.
    host.features.set('story-director.threads', false);
    await host.st.editMessage(at, reply('The square fills.', [RIOT, SECOND, '+ world Third — x | state: looming | place: Highmark']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    const names = Object.values(host.head().domains.chronicle.events).map(event => event.name).sort();
    assert.deepEqual(names, ['Bread Riots', 'Second Thing'], 'no one-line limit with the switch off (a new line is not used: its kind is off)');
    assert.equal('worldLine' in host.head().domains.chronicle, false);
    assert.equal('conditions' in host.head().domains.chronicle, false);
    assert.doesNotMatch(host.sdk.receipts().map(entry => String(entry.receipt.summary ?? '')).join('\n'), /Not used: "unrest"/);
    host.close();
});

test('on the host: swipe and swipe back with a world line on both swipes, then a rewind and a chat change', async () => {
    const host = await newHost(true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT, SECOND]));
    const first = keys(host);
    // The other swipe has its own world line (and the second line is refused there too): only grain-dear.
    await host.swipe(reply('Quiet square.', ['+ world Bread Prices — dearer bread | state: ongoing | place: Highmark | conditions: +grain-dear', SECOND]));
    assert.deepEqual(keys(host), ['grain-dear@The March']);
    assert.equal(Object.values(host.head().domains.chronicle.events).some(event => event.name === 'Second Thing'), false);
    await agrees(host, 'other swipe');
    // Back to the first swipe: its line is taken again (the reply's mark is per record), its conditions are back.
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(keys(host), first);
    await agrees(host, 'swipe back');
    // Rewind: delete back to the first reply, nothing the deleted replies set is left.
    while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.deepEqual(keys(host), []);
    assert.equal(Object.keys(host.head().domains.chronicle.worldLine ?? {}).length, 0);
    await agrees(host, 'rewind');
    // A chat change and back: the store follows the chat.
    const saved = structuredClone(host.ctx.chat);
    await host.st.loadChat([], 'other-chat');
    await host.st.loadChat(saved, 'first-chat');
    assert.deepEqual(keys(host), []);
    host.close();
});

test('on the host: a ninth condition on one place is a note on the card and the world line stands (the cap is asked before the call)', async () => {
    const names = Array.from({ length: 9 }, (_, i) => `woe-${i + 1}`);
    const pack = JSON.parse(PACK);
    pack.id = 'world-line-cap';
    pack.content.conditions = names.map(name => ({ name, scope: 'place', fades: 'until cleared', means: 'Trouble.' }));
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(JSON.stringify(pack), { origin: 'pack.json' })).ok, true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Woe.', reply('Everything goes wrong.', [`+ world Woes — all at once | state: ongoing | place: Highmark | conditions: ${names.slice(0, 5).map(n => `+${n}`).join(', ')}`]));
    // Five already there; one line asks four more: the cap is counted with what the same line set a moment before.
    await host.send('More.', reply('And more.', [`+ world More Woes — again | state: ongoing | place: Highmark | conditions: ${names.slice(5).map(n => `+${n}`).join(', ')}`]));
    assert.equal(keys(host).length, 8);
    assert.ok(Object.values(host.head().domains.chronicle.events).some(event => event.name === 'More Woes'), 'the line stands');
    assert.match(summaries(host), /Not used: "woe-9": Highmark already carries 8 conditions/);
    host.close();
});

test('on the host: a chat that had the switch on, then off: a Re-read with threads off runs the plain line, so the conditions it had set are gone', async () => {
    const host = await newHost(true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT, SECOND]));
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark']);
    host.features.set(FEATURE, false);
    host.features.set('story-director.threads', false);
    const at = host.ctx.chat.findIndex(message => /The square fills\./.test(message.mes));
    await host.st.editMessage(at, reply('The square fills, edited.', [RIOT, SECOND]));
    assert.equal((await host.sdk.reread(at)).ok, true);
    // Off now: the line runs plain (it sets no conditions), so the conditions it had set are gone (the switch, not the Re-read, decides).
    // The second line was refused when first read, so it made no change and is not run again while its kind is off.
    assert.deepEqual(keys(host), []);
    assert.deepEqual(Object.values(host.head().domains.chronicle.events).map(event => event.name).sort(), ['Bread Riots']);
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live);
    host.close();
});

test('on the host (test 7, the world line\'s side): a clear on a day is not undone by a later world line that day; swiping the clear frees it; replay == live', async () => {
    const host = await newHost(true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT]));
    await host.send('Calm.', reply('The crowds go home.', ['! time +30m', '+ world Bread Riots — calm | state: over | place: Highmark | conditions: -unrest']));
    const clearing = host.ctx.chat.length - 1;
    await host.send('Again.', reply('Shouts again.', ['! time +30m', '+ world New Riot — shouts | state: ongoing | place: Highmark | conditions: +unrest']));
    assert.deepEqual(keys(host), ['grain-dear@The March'], 'cleared earlier today: not set again');
    assert.match(summaries(host), /Not used: "unrest": unrest was cleared on Highmark today/);
    assert.deepEqual(host.head().domains.chronicle.ledger[0].tomb.keys, ['unrest@Highmark']);
    await agrees(host, 'tomb');
    const later = host.ctx.chat.length - 1;
    // An edited Re-read of the clearing reply without the clear: unrest stays and no clear is kept for today; the later reply keeps what
    // it recorded (its line was refused then; history is not rewritten).
    await host.st.editMessage(clearing, reply('The crowds stay.', ['! time +30m', '+ world Bread Riots — still | state: ongoing | place: Highmark']));
    assert.equal((await host.sdk.reread(clearing)).ok, true);
    assert.equal(host.head().domains.chronicle.ledger?.[0]?.tomb, undefined, 'no clear today any more');
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark']);
    await agrees(host, 'Re-read of the clear');
    await host.st.deleteMessage(clearing);
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, 'middle delete');
    assert.ok(later > clearing);
    host.close();
});

test('on the host (E24): a world line\'s anchors go to the ledger, the next day\'s step takes them; deleting the world line\'s reply, a chat change and a reload agree', async () => {
    const host = await newHost(true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT]));
    const lined = host.ctx.chat.length - 1;
    assert.deepEqual(Object.keys(host.head().domains.chronicle.ledger[0].anchors).sort(), ['set:grain-dear', 'set:grain-dear@The March', 'set:unrest', 'set:unrest@Highmark']);
    await host.send('Sleep.', reply('Morning.', ['! time +1d']));
    const daily = host.head().domains.chronicle.daily[0];
    assert.equal(host.head().domains.chronicle.ledger, null, 'the step took them');
    assert.ok(Array.isArray(daily.anchors['set:unrest@Highmark']), 'into its own, permanent anchors');
    await agrees(host, 'taken');
    await host.st.deleteMessage(lined);
    assert.deepEqual(host.store.problems(), []);
    assert.ok(Array.isArray(host.head().domains.chronicle.daily[0].anchors['set:unrest@Highmark']), 'the later step keeps what it recorded');
    await agrees(host, 'world line deleted');
    const saved = structuredClone(host.ctx.chat);
    await host.st.loadChat([], 'other-chat');
    await host.st.loadChat(saved, 'first-chat');
    await agrees(host, 'chat change and back');
    host.close();
});
