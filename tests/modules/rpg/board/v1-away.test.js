// "Companions who are away wait" (Settings → RPG, off unless set): a companion the story has away sits out the fight and is paid `awayXp` percent of a win; recorded at open, so replays settle the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { awayFrom } from '../../../../modules/rpg/names.js';
import { waitShare, waitsOf, withoutWaits } from '../../../../modules/rpg/board/v1-away.js';
import { rollReceipt } from '../helpers.js';
import { api, openFight, stage, step } from './v1.helpers.js';
import { HERO_ID, REN_ID, astraXp, record, renXp, twoHeroes } from './v1-away.helpers.js';

const open = host => host.ctx.chatMetadata.storySuiteInteraction.open;
const win = async host => {
    for (let at = 0; at < 14; at += 1) stage(host, step('skill'));
    await host.send('Go.', 'Done.');
};
const ON = { wait: true, xp: 50 };

test('the settings: off unless set; the XP share counts only while waiting is on, 0 to 100', () => {
    assert.deepEqual(awayFrom(undefined), { wait: false, xp: 0 });
    assert.deepEqual(awayFrom({ rpgAwayXp: 50 }), { wait: false, xp: 0 });
    assert.deepEqual(awayFrom({ rpgAwayWait: true, rpgAwayXp: 150 }), { wait: true, xp: 100 });
    assert.deepEqual(awayFrom({ rpgAwayWait: true, rpgAwayXp: -5 }), { wait: true, xp: 0 });
});

test('waitsOf, withoutWaits and waitShare are plain reads', () => {
    const sheet = { characters: [{ key: 'astra', who: 'Astra', level: 5 }, { key: 'ren', who: 'Ren', level: 2 }] };
    const slice = { away: { aw_1: record('Ren') } };
    assert.deepEqual(waitsOf(slice, sheet, () => true), [{ id: 'ren', label: 'Ren', level: 2 }]);
    assert.deepEqual(waitsOf({ away: { aw_1: record('Ren', { home: 5 }) } }, sheet, () => true), [], 'back: no absence');
    assert.deepEqual(waitsOf({ away: { a: record('Ren'), b: record('Astra') } }, sheet, () => true), [], 'everyone away: nobody is benched');
    assert.deepEqual(waitsOf(undefined, sheet, () => true), []);
    assert.deepEqual(withoutWaits({ party: [{ id: 'astra' }, { id: 'ren' }], foes: [] }, { waits: [{ id: 'ren' }] }).party, [{ id: 'astra' }]);
    assert.equal(waitShare(15, 50), 7);
    assert.equal(waitShare(1, 10), 1, 'at least 1 when it earns anything');
    assert.deepEqual([waitShare(0, 50), waitShare(15, 0)], [0, 0]);
});

test('off (the default): the companion who is away fights and is paid as before', async () => {
    const restore = seedCrypto(31);
    try {
        const host = await twoHeroes({ away: { aw_1: record('Ren') } });
        assert.equal(openFight(host).ok, true);
        assert.equal(open(host).setup.waits, undefined);
        await win(host);
        assert.deepEqual(rollReceipt(host, 2).data.v2.result.paid.xp.map(row => row.who).sort(), ['Astra', 'Ren']);
    } finally { restore(); }
});

test('on: the companion who is away sits out the fight and waits; with a share they are paid that percent of a hero of their level', async () => {
    const restore = seedCrypto(32);
    try {
        const host = await twoHeroes({ away: { aw_1: record('Ren') } });
        assert.equal(openFight(host, { away: ON }).ok, true);
        assert.deepEqual(open(host).setup.waits, [{ id: 'ren', label: 'Ren', level: 2 }]);
        assert.equal(open(host).setup.awayXp, 50);
        assert.equal(api(host).current().view.result.party.some(hero => hero.id === 'ren'), false, 'Ren is not on the board');
        await win(host);
        const got = rollReceipt(host, 2).data.v2.result;
        assert.equal(got.stop, 'won');
        assert.deepEqual(got.paid.xp.map(row => row.who), ['Astra', 'Ren']);
        const [astra, ren] = got.paid.xp;
        assert.ok(ren.xp > 0 && ren.xp <= astra.xp, 'Ren is paid a share');
        assert.equal(renXp(host), ren.xp);
        assert.equal(astraXp(host), astra.xp);
    } finally { restore(); }
});

test('on with no share: the companion waits and is paid nothing; back from away: they fight again', async () => {
    const restore = seedCrypto(33);
    try {
        const host = await twoHeroes({ away: { aw_1: record('Ren') } });
        openFight(host, { away: { wait: true, xp: 0 } });
        assert.equal(open(host).setup.awayXp, undefined);
        await win(host);
        assert.deepEqual(rollReceipt(host, 2).data.v2.result.paid.xp.map(row => row.who), ['Astra']);
        assert.equal(renXp(host), 0);
        const back = await twoHeroes({ away: { aw_1: record('Ren', { home: 9 }) } });
        openFight(back, { away: ON });
        assert.equal(open(back).setup.waits, undefined, 'an ended absence benches nobody');
    } finally { restore(); }
});

test('replay equals live: a swipe, a swipe back and a reload settle the same pay', async () => {
    const restore = seedCrypto(34);
    try {
        const host = await twoHeroes({ away: { aw_1: record('Ren') } });
        openFight(host, { away: ON });
        await win(host);
        const live = JSON.stringify([rollReceipt(host, 2).data.v2.result.paid, renXp(host), astraXp(host)]);
        await host.swipe('Told.');
        assert.equal(JSON.stringify([rollReceipt(host, 2).data.v2.result.paid, renXp(host), astraXp(host)]), live, 'swipe');
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.equal(JSON.stringify([rollReceipt(host, 2).data.v2.result.paid, renXp(host), astraXp(host)]), live, 'swipe back');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'away-wait');
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify([rollReceipt(host, 2).data.v2.result.paid, renXp(host), astraXp(host)]), live, 'reload');
    } finally { restore(); }
});

test('the sheet carries where the Director says a companion is away (the Party tab shows it only while waiting is on); without the Director it is null', async () => {
    const view = { people: [{ name: 'Ren', away: true, doing: 'scouting the north road', newsAgo: '2 days ago', due: false, back: 'Goldwane 18' }, { name: 'Mira', away: false, doing: '', due: false, back: '' }] };
    const host = await twoHeroes({ queries: { 'director.away.view': () => view } });
    const rows = host.sdk.query('rpg.sheet');
    assert.deepEqual(rows.map(row => row.id), [HERO_ID, REN_ID]);
    assert.deepEqual([rows[0].away, rows[1].away], [null, { where: 'scouting the north road', lastSeen: '2 days ago', short: 'back Goldwane 18' }]);
    host.close();
    const bare = await twoHeroes();
    assert.deepEqual(bare.sdk.query('rpg.sheet').map(row => row.away), [null, null]);
    bare.close();
});
