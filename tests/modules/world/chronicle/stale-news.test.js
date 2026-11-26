// World news with no word for STALE_NEWS_DAYS story days is old: marked in World › News and left out of the narrator's world lines. It is
// worked out on read (nothing stored), a new world line brings it back, and a rebuild, swipe or Re-read gives the same.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { chronicleTail, TAIL_HEADER } from '../../../../modules/world/chronicle/note.js';
import { worldNote } from '../../../../modules/world/chronicle/world-note.js';
import { STALE_NEWS_DAYS, isStaleNews } from '../../../../modules/world/chronicle/domain-parts/stale.js';
import { SURFACE } from '../../../../modules/world/chronicle/pick.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { clockAt, lines, makeState, runCommand, viewOf } from './helpers/fake-ctx.js';

const DAY = 1440;
const BLOCK = '+ world Boom at Lower Bend — a chain across the river\n+ world Cleared Road — the road is open | state: resolved';
const LAST_TAIL = 'story_suite_tail_1';
const reply = (text, changes = []) => (changes.length ? `${text}\n<Changes>\n${changes.join('\n')}\n</Changes>` : text);
const tailText = state => chronicleTail(viewOf(state)).lines.join('\n');

test('old after STALE_NEWS_DAYS, not a minute before; resolved, kept, locked, rumour and undated entries never', () => {
    assert.equal(STALE_NEWS_DAYS, 30);
    const open = { state: 'ongoing', updated: DAY };
    const limit = DAY + 30 * DAY;
    assert.equal(isStaleNews(open, limit - 1), false);
    assert.equal(isStaleNews(open, limit), true);
    assert.equal(isStaleNews({ ...open, state: 'looming' }, limit), true);
    for (const other of [{ state: 'resolved' }, { keep: true }, { locked: true }, { by: 'siege' }, { rumour: 'Siege' }, { updated: null }]) {
        assert.equal(isStaleNews({ ...open, ...other }, limit * 2), false, JSON.stringify(other));
    }
    assert.equal(isStaleNews(open, null), false);
    // News that reached the party late counts from when it arrived.
    assert.equal(isStaleNews({ ...open, arrivesAt: 20 * DAY }, limit), false);
    assert.equal(isStaleNews({ ...open, arrivesAt: 20 * DAY }, 50 * DAY), true);
    assert.equal(isStaleNews({ ...open, arrivesAt: 999 * DAY }, limit), true, 'a courier still on the way changes nothing');
});

test('the [World] tail drops old news and keeps the rest; the stored state is not touched', () => {
    const first = lines(makeState({ minutes: DAY }), BLOCK).state;
    assert.match(tailText(clockAt(first, 30 * DAY)), /Boom at Lower Bend/);
    const later = clockAt(first, 31 * DAY);
    const stored = JSON.stringify(later);
    assert.deepEqual(chronicleTail(viewOf(later)).lines, [], 'nothing else is under way: no header either');
    assert.equal(JSON.stringify(later), stored);
    const two = lines(later, '+ world Frost — rime on the road').state;
    assert.ok(tailText(two).startsWith(TAIL_HEADER));
    assert.match(tailText(two), /Frost/);
    assert.doesNotMatch(tailText(two), /Lower Bend/);
    // More than three open events and a recorded pick: the old one gives up its seat.
    const many = lines(clockAt(two, 31 * DAY), '+ world A — a\n+ world B — b\n+ world C — c').state;
    assert.doesNotMatch(tailText(many), /Lower Bend/);
    assert.equal(chronicleTail(viewOf(many)).lines.length, 4);
    // A pick recorded while an event was fresh still holds its id once it is old: the seat goes to another.
    const four = lines(makeState({ minutes: DAY }), '+ world A — a\n+ world B — b\n+ world C — c').state;
    const aged = lines(four, '+ world Old One — o').state;
    const picked = runCommand(aged, part.commands[SURFACE], { at: 10 }, { cause: 'system' }).state;
    const id = Object.values(picked.domains.chronicle.events).find(event => event.name === 'A').id;
    assert.ok(picked.domains.chronicle.surfaced);
    const newer = lines(clockAt(picked, 20 * DAY), '~ world B — b2\n~ world C — c2\n~ world Old One — o2').state;
    const text = tailText(clockAt(newer, 31 * DAY));
    assert.ok(id);
    assert.doesNotMatch(text, /- A[.:]/);
    assert.equal(text.split('\n').length, 4);
    // A later ~ line with new words brings it back.
    const back = lines(two, '~ world Boom at Lower Bend — the chain is still up').state;
    assert.match(tailText(back), /Lower Bend/);
});

test('the world note leaves old news out of what has reached here', () => {
    const heard = [{ name: 'Old Boom', summary: 'chain', state: 'ongoing', updated: DAY, arrivesAt: DAY }, { name: 'Fresh Frost', summary: 'rime', state: 'ongoing', updated: 40 * DAY, arrivesAt: 40 * DAY }];
    const answers = { 'world.heardHere': heard, 'director.time': { minutes: 41 * DAY }, 'scene.place': { name: 'Quay' } };
    const view = { state: { domains: { chronicle: {} } }, feature: () => true, query: name => answers[name] ?? null };
    const text = worldNote(view).map(line => line.text ?? line).join('\n');
    assert.match(text, /Fresh Frost/);
    assert.doesNotMatch(text, /Old Boom/);
});

async function newHost() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [module] });
    return host;
}
const news = host => host.sdk.query('director.world', {}).news.map(item => [item.name, item.state, item.stale === true]);

test('on the host: old news is marked, a dated happening still to come is not, and rebuild, swipe and Re-read agree', async t => {
    const host = await newHost();
    t.after(() => host.close());
    await host.send('Evening.', reply('Smoke.', ['~ time June 3, 1200, 08:00 pm', ...BLOCK.split('\n'),
        '+ event Bell Fault — the bell is cracked', '+ event Harvest Fair — stalls in the square | on: August 20, 1200']));
    assert.ok(news(host).every(([, , stale]) => !stale));
    await host.send('Weeks pass.', reply('Summer.', ['! time +20d']));
    assert.ok(news(host).every(([, , stale]) => !stale), '20 days on, nothing is old');
    await host.send('More weeks.', reply('Late summer.', ['! time +11d']));
    const aged = news(host);
    assert.deepEqual(aged.filter(([, , stale]) => stale).map(([name]) => name).sort(), ['Bell Fault', 'Boom at Lower Bend']);
    assert.deepEqual(aged.find(([name]) => name === 'Cleared Road'), ['Cleared Road', 'resolved', false]);
    assert.equal(host.sdk.query('chronicle.event', { name: 'Boom at Lower Bend' }).state, 'ongoing', 'the stored state is as the story left it');
    await host.send('And?', reply('Quiet.'));
    const told = host.st.promptLog.filter(entry => entry.key === LAST_TAIL && entry.value).at(-1)?.value ?? '';
    assert.doesNotMatch(told, /Lower Bend/);

    await host.send('News?', reply('The chain holds.', ['~ world Boom at Lower Bend — the chain still holds']));
    assert.deepEqual(news(host)[0], ['Boom at Lower Bend', 'ongoing', false]);
    const live = JSON.stringify(news(host));
    await host.turn.reread(host.ctx.chat.length - 1);
    assert.equal(JSON.stringify(news(host)), live, 'Re-read');
    await host.swipe(reply('Nothing new.'));
    assert.deepEqual(news(host).find(([name]) => name === 'Boom at Lower Bend'), ['Boom at Lower Bend', 'ongoing', true], 'the swipe takes the line back');
    const swiped = JSON.stringify(news(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(news(host)), swiped, 'rebuild');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(news(host)), swiped, 'reload');
});
