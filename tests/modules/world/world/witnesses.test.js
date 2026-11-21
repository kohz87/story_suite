// Journal witnesses: who was there for each earlier-day line, derived from the day digests on read (switch story-director.witnesses, default off);
// a person's lines for the dossier's Past; replay (swipe, middle delete) equals a rebuild.
import test from 'node:test';
import assert from 'node:assert/strict';

import { WITNESSES } from '../../../../modules/world/world/journal.js';
import { said, worldHost } from './helpers.js';

async function story(features) {
    const host = await worldHost();
    for (const [id, on] of Object.entries(features)) host.features.set(id, on);
    await host.send('Hello.', said('The harbour at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Harbour', '+ present Mira, Old Tom', '+ hook Rat Cellar — clear the cellar | goal: kill 3 rats']));
    await host.send('Next day.', said('Morning again.', ['~ time June 4, 1200, 09:00 am', '+ present Brecht', '+ world Red Plague — coughing in the docks | state: ongoing | place: Harbour']));
    await host.send('Look round.', said('Quiet streets.', ['~ time June 5, 1200, 07:00 am', '+ present Kell']));
    return host;
}

const data = host => ({ all: host.sdk.query('journal.witnesses'), mira: host.sdk.query('journal.witnesses', { name: 'mira' }), journal: host.sdk.query('director.journal') });

test('off by default: nothing is read, nothing changes', async () => {
    const host = await story({});
    const { all, mira } = data(host);
    host.close();
    assert.deepEqual([all.on, all.days, mira.lines], [false, [], []]);
});

test('on: each earlier-day line names who was there; a person gets the lines they were present for, newest day first', async () => {
    const host = await story({ [WITNESSES]: true });
    const { all, mira, journal } = data(host);
    host.close();
    assert.equal(all.on, true);
    const withWho = all.days.flatMap(day => day.lines.filter(line => line.who.length));
    assert.ok(withWho.length > 0, JSON.stringify(all));
    assert.ok(withWho.some(line => line.who.includes('Mira')));
    assert.ok(mira.lines.length > 0 && mira.lines.every(line => line.date && line.text));
    const dates = journal.days.map(day => day.date);
    const order = mira.lines.map(line => dates.indexOf(line.date));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), 'newest day first');
    assert.deepEqual(host.sdk.query('journal.witnesses', { name: 'Nobody Here' }).lines, []);
});

test('replay: after a swipe and a middle delete, the witnesses are what a rebuild gives', async () => {
    const host = await story({ [WITNESSES]: true });
    const read = () => JSON.stringify(data(host));
    await host.swipe(said('Quiet again.', ['~ time June 5, 1200, 07:30 am', '+ present Wynn']));
    const live = read();
    host.store.rebuild();
    assert.equal(read(), live, 'swipe: rebuild != live');
    const user = host.ctx.chat.findIndex(message => message.is_user && /Look round/.test(message.mes));
    await host.st.deleteMessage(user + 1);
    await host.st.deleteMessage(user);
    const after = read();
    host.store.rebuild();
    assert.equal(read(), after, 'middle delete: rebuild != live');
    host.close();
});
