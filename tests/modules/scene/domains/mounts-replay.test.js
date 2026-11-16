// The party's mounts (src/v2/domains/mounts.js, feature `story-block.mounts`): queries, pencil edit, replay and Home.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { MAX_ROWS, MOUNTS_FEATURE, WALK_PACE } from '../../../../modules/scene/mounts.js';
import { validateScene } from '../../../../modules/scene/index.js';
import { mountUi } from '../../../../ui/legacy/ui-host.js';
import { homeScreen } from '../../../../ui/legacy/screens/index.js';
import { checkInvariants } from '../../../suite/qa/helpers/oracle.js';
import { recordingWidgets, renderSkip, show, text } from '../../../ui/screens/helpers.js';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { MARE, block, character, fresh, lastIndex, names, problems } from './mounts.helpers.js';

// ---------------------------------------------------------------------------------------------------
// The queries: copies, story order, riders

test('mounts.list gives copies; mounts.pace is the slowest row and walks when the party has too few mounts', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Burr | kind: mule']));
    const list = host.sdk.query('mounts.list');
    list[0].name = 'changed';
    assert.equal(host.sdk.query('mounts.list')[0].name, 'Grey Mare', 'a copy');
    // The RPG is off: one rider.
    assert.deepEqual(host.sdk.query('mounts.pace'), { pace: 25, mounts: 2, riders: 1, short: 0, slowest: 'Burr' });
    await host.send('Sold.', block('Sold.', ['- mount Burr']));
    assert.deepEqual(host.sdk.query('mounts.pace'), { pace: 35, mounts: 1, riders: 1, short: 0, slowest: 'Grey Mare' });
    await host.send('Gone.', block('Gone.', ['- mount Grey Mare']));
    assert.equal(host.sdk.query('mounts.pace'), null, 'no mount, no pace');
    assert.deepEqual(host.sdk.query('mounts.list'), []);
});

test('with the RPG on, the riders are the party\'s characters who have not left; short walks at 20', async t => {
    const host = await fresh(t);
    host.features.set(CORE_FEATURE.leanRpg, true);
    await character(host, 'Wessel');
    await character(host, 'Mara');
    await character(host, 'Tobin');
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Burr | kind: mule']));
    assert.deepEqual(host.sdk.query('mounts.pace'), { pace: WALK_PACE, mounts: 2, riders: 3, short: 1, slowest: 'Burr' }, 'three riders, two mounts: they walk');
    await host.send('More.', block('More.', ['+ mount Pia | kind: pony']));
    assert.deepEqual(host.sdk.query('mounts.pace'), { pace: 25, mounts: 3, riders: 3, short: 0, slowest: 'Burr' });
    // Someone who left is not carried.
    await host.send('Tobin goes home.', block('Goodbye.', ['- party Tobin', '- mount Pia']));
    assert.deepEqual(problems(host), []);
    assert.deepEqual(host.sdk.query('mounts.pace'), { pace: 25, mounts: 2, riders: 2, short: 0, slowest: 'Burr' }, 'Tobin left: two riders, two mounts');
    host.features.set(CORE_FEATURE.leanRpg, false);
    assert.deepEqual(host.sdk.query('mounts.pace'), { pace: 25, mounts: 2, riders: 1, short: 0, slowest: 'Burr' }, 'the RPG off: the one reader');
});

// ---------------------------------------------------------------------------------------------------
// The reader's pencil

test('mounts.edit changes a row by hand on the latest reply, and only the reader can', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Burr | kind: mule']));
    const saves = host.ctx.chat.length;
    const edit = await host.sdk.command('mounts.edit', { mount: 'Burr', condition: 'sore', pace: 22, count: 2, where: 'at the farrier', kind: 'mule', name: 'Old Burr' });
    assert.equal(edit.ok, true, edit.message);
    assert.deepEqual(host.sdk.query('mounts.list')[1], { name: 'Old Burr', kind: 'mule', count: 2, pace: 22, condition: 'sore', where: 'at the farrier' });
    assert.equal(host.ctx.chat.length, saves, 'kept on the latest reply');
    assert.equal(host.ctx.chat.at(-1).extra.storySuite.receipts.at(-1).type, 'mounts.edit');
    assert.equal(host.ctx.chat.at(-1).extra.storySuite.receipts.at(-1).data.edit, true);
    for (const [payload, pattern] of [
        [{ mount: 'Nobody', condition: 'x' }, /no mount called Nobody/],
        [{ condition: 'x' }, /Which mount/],
        [{ mount: 'Old Burr', name: 'grey mare' }, /already the name/],
        [{ mount: 'Old Burr', name: '  ' }, /needs the mount's name/],
        [{ mount: 'Old Burr', count: 'lots' }, /whole number/],
        [{ mount: 'Old Burr', condition: 5 }, /must be text/],
    ]) {
        const result = await host.sdk.command('mounts.edit', payload);
        assert.equal(result.ok, false, JSON.stringify(payload));
        assert.match(result.message, pattern);
    }
    assert.equal(host.sdk.query('mounts.list')[1].name, 'Old Burr', 'the refusals changed nothing');
    // The story cannot use the command (its lines are the capture kind).
    await host.send('Say.', block('Say.', ['+ mount Pia | kind: pony']));
    assert.equal(names(host).includes('Pia'), true);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
});

// ---------------------------------------------------------------------------------------------------
// Replay: a swipe, Re-read, a middle delete and a reload

test('a swipe takes its mounts back; Re-read keeps them; a reload reads what the story holds', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE]));
    await host.send('More.', block('More.', ['+ mount Burr | kind: mule', '~ mount Grey Mare | condition: tired']));
    const at = lastIndex(host);
    assert.deepEqual(names(host), ['Grey Mare', 'Burr']);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(host.sdk.query('mounts.list').map(row => [row.name, row.condition]), [['Grey Mare', 'tired'], ['Burr', '']]);
    // A swipe has its own mounts; the other swipe, with none, rolls back to the reply before.
    await host.swipe(block('Another.', ['+ mount Pia | kind: pony', '- mount Grey Mare']));
    assert.deepEqual(names(host), ['Pia']);
    await host.swipe('Nothing this time.');
    assert.deepEqual(host.sdk.query('mounts.list').map(row => [row.name, row.condition]), [['Grey Mare', '']]);
    await host.st.swipeTo(at, 0);
    assert.deepEqual(host.sdk.query('mounts.list').map(row => [row.name, row.condition]), [['Grey Mare', 'tired'], ['Burr', '']]);
    checkInvariants(host, 'after the swipes');
    // Re-read after the reply's text was edited: the old lines' effects are replaced by the new ones.
    host.ctx.chat[at].mes = block('More.', ['+ mount Burr | kind: mule | pace: 24']);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(host.sdk.query('mounts.list').map(row => [row.name, row.pace, row.condition]), [['Grey Mare', 35, ''], ['Burr', 24, '']]);
    checkInvariants(host, 'after Re-read');
    const other = await createHost({ st: { chat: host.ctx.chat } });
    t.after(() => other.close());
    assert.deepEqual(other.head(), host.head());
    assert.deepEqual(other.sdk.query('mounts.list'), host.sdk.query('mounts.list'));
});

test('deleting the reply that added a mount: later replies still apply, a change to the gone mount is passed over, nothing is skipped', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE]));                                  // first: makes the field and Grey Mare
    const first = lastIndex(host);
    await host.send('Burr.', block('Burr.', ['+ mount Burr | kind: mule']));
    const second = lastIndex(host);
    await host.send('Both.', block('Both.', ['~ mount Grey Mare | condition: tired', '~ mount Burr | condition: lame', '~ place Weir | kind: ford']));
    await host.send('Pia.', block('Pia.', ['+ mount Pia | kind: pony', '- mount Burr']));
    assert.deepEqual(names(host), ['Grey Mare', 'Pia']);
    // The first reply deleted: Burr and Pia (the field is made again), Grey Mare's tired is passed over, the place still moves.
    await host.st.deleteMessage(first);
    await host.st.deleteMessage(first - 1);
    assert.deepEqual(host.store.problems(), [], 'nothing skipped');
    assert.deepEqual(names(host), ['Pia']);
    assert.equal(host.sdk.query('scene.place').name, 'Weir', 'the rest of the reply that changed the gone mount applied');
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    checkInvariants(host, 'after the first delete');
    // The second reply (Burr's) deleted too: the lame and the removal of Burr are passed over.
    const index = host.ctx.chat.findIndex((message, n) => !message.is_user && n > 0 && /\+ mount Burr/.test(message.mes));
    assert.ok(index > 0 && second > 0);
    await host.st.deleteMessage(index);
    await host.st.deleteMessage(index - 1);
    assert.deepEqual(host.store.problems(), []);
    assert.deepEqual(names(host), ['Pia']);
    checkInvariants(host, 'after the second delete');
    // Deleting the last reply takes Pia back; a fresh host over the chat agrees.
    await host.st.deleteMessage(lastIndex(host));
    assert.deepEqual(names(host), []);
    assert.equal(host.sdk.query('mounts.pace'), null);
    await host.send('Again.', block('Again.', ['+ mount Pia | kind: pony']));
    const other = await createHost({ st: { chat: host.ctx.chat } });
    t.after(() => other.close());
    assert.deepEqual(other.head(), host.head());
});

test('the cap is checked on replay too: taking away the reply that sold a mount skips the block that would make a seventh, alone', async t => {
    const host = await fresh(t);
    await host.send('Six.', block('Six.', ['A', 'B', 'C', 'D', 'E', 'F'].map(name => `+ mount ${name}`)));
    const six = lastIndex(host);
    await host.send('Sell.', block('Sell.', ['- mount A']));
    await host.send('Buy.', block('Buy.', ['+ mount G', '~ place Dock']));
    assert.deepEqual(names(host), ['B', 'C', 'D', 'E', 'F', 'G']);
    // Taking away the sale: G would be a seventh, so that reply's block is skipped whole (reported), not the state broken.
    const sale = host.ctx.chat.findIndex(message => !message.is_user && /- mount A/.test(message.mes));
    await host.st.deleteMessage(sale);
    await host.st.deleteMessage(sale - 1);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    assert.equal(names(host).length <= MAX_ROWS, true);
    assert.ok(six > 0);
    checkInvariants(host, 'after the delete');
});

// ---------------------------------------------------------------------------------------------------
// Home

test('Home shows the Mounts card only while the party has a mount: a row each, the slowest, and the walk when short', { skip: renderSkip }, async t => {
    const host = await fresh(t);
    const query = (name, args) => host.sdk.query(name, args);
    const card = () => show(homeScreen, { state: host.head(), query, widgets: recordingWidgets().widgets });
    assert.equal(card().el.querySelectorAll('.mounts').length, 0, 'no mount, no card');
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Guild remounts | kind: horse | count: 4', '+ mount Burr | kind: mule | condition: tired | where: led', '+ mount Cart <b>one</b> | kind: cart']));
    const { el, view } = card();
    assert.deepEqual(view.warnings, []);
    const rows = el.querySelectorAll('.mounts .mount');
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map(row => text(row.querySelector('.mount-name b'))), ['Grey Mare', 'Guild remounts', 'Burr', 'Cart <b>one</b>']);
    assert.equal(text(rows[0].querySelector('.mount-sub')), 'horse · ridden by Wessel');
    assert.equal(text(rows[1].querySelector('.mount-name')).includes('×4'), true);
    assert.equal(text(rows[2].querySelector('.mount-sub')), 'mule · tired · led');
    assert.equal(text(rows[0].querySelector('.mount-pace')), '35 km/day');
    assert.equal(text(rows[2].querySelector('.mount-pace')), '25 km/day');
    assert.equal(rows[0].querySelectorAll('.fa-horse').length, 1, 'a horse icon');
    assert.equal(rows[2].querySelectorAll('.fa-horse-head').length, 1, 'a mule icon');
    assert.equal(rows[3].querySelectorAll('.fa-cart-flatbed').length, 1, 'a cart icon');
    assert.equal(el.querySelectorAll('.mounts b b, .mounts i[onerror]').length, 0, 'text is text');
    assert.equal(text(el.querySelector('.mount-note')), 'The party travels at the slowest: 18 km/day riding.');
    host.features.set(CORE_FEATURE.leanRpg, true);
    for (const who of ['Wessel', 'Mara']) await character(host, who);
    await host.send('Sold.', block('Sold.', ['- mount Burr', '- mount Cart <b>one</b>', '- mount Guild remounts']));
    assert.equal(text(card().el.querySelector('.mount-note')), 'Not enough mounts for everyone: the party walks (20 km/day).', 'one mount, two riders');
});

test('the pencil on a Home row opens the six fields (gear off), saves only what changed on the latest reply, and shows the row again', { skip: renderSkip }, async t => {
    const doc = setupDom(), form = doc.createElement('div');
    form.id = 'send_form';
    doc.body.appendChild(form);
    const host = await fresh(t);
    const ui = mountUi({ runtime: host, ctx: host.ctx, doc });
    t.after(() => ui.destroy());
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Burr | kind: mule']));
    assert.equal(ui.mounts.screen.open('story-block/home'), true);
    const rows = () => doc.querySelectorAll('.ss-gameview .mounts .mount');
    assert.equal(rows().length, 2);
    const pencil = rows()[1].querySelector('.ss-w-editable-pencil');
    assert.equal(pencil.getAttribute('aria-label'), 'Edit mount');
    pencil.click();
    const inputs = rows()[1].querySelectorAll('.ss-w-editable-form input');
    assert.deepEqual(inputs.map(input => input.getAttribute('aria-label')), ['Name', 'Kind', 'How many', 'Pace (km/day)', 'Condition', 'Where']);
    assert.deepEqual(inputs.map(input => input.value), ['Burr', 'mule', '1', '25', '', '']);
    inputs[4].value = 'lame';
    inputs[5].value = 'stabled at the Stray Oar';
    inputs[3].value = '999';
    rows()[1].querySelector('.ss-w-editable-save').click();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(host.sdk.query('mounts.list')[1], { name: 'Burr', kind: 'mule', count: 1, pace: 200, condition: 'lame', where: 'stabled at the Stray Oar' }, 'a pace past the limit is held');
    assert.equal(host.ctx.chat.at(-1).extra.storySuite.receipts.at(-1).type, 'mounts.edit');
    assert.equal(text(rows()[1].querySelector('.mount-sub')), 'mule · lame · stabled at the Stray Oar');
    assert.equal(text(rows()[1].querySelector('.mount-pace')), '200 km/day');
    // Nothing changed: no command.
    const receipts = host.ctx.chat.at(-1).extra.storySuite.receipts.length;
    rows()[0].querySelector('.ss-w-editable-pencil').click();
    rows()[0].querySelector('.ss-w-editable-save').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(host.ctx.chat.at(-1).extra.storySuite.receipts.length, receipts);
    // Off: the card goes with the feature.
    host.features.set(MOUNTS_FEATURE, false);
    assert.equal(rows().length, 0);
});

test('the pencil has the seventh field, Carry, only with gear on (G5)', { skip: renderSkip }, async t => {
    const doc = setupDom(), form = doc.createElement('div');
    form.id = 'send_form';
    doc.body.appendChild(form);
    const host = await fresh(t);
    host.features.set(CORE_FEATURE.leanRpg, true);
    host.features.set('story-block.gear', true);
    const ui = mountUi({ runtime: host, ctx: host.ctx, doc });
    t.after(() => ui.destroy());
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Burr | kind: mule']));
    assert.equal(ui.mounts.screen.open('story-block/home'), true);
    const rows = () => doc.querySelectorAll('.ss-gameview .mounts .mount');
    rows()[1].querySelector('.ss-w-editable-pencil').click();
    const inputs = rows()[1].querySelectorAll('.ss-w-editable-form input');
    assert.deepEqual(inputs.map(input => input.getAttribute('aria-label')), ['Name', 'Kind', 'How many', 'Pace (km/day)', 'Condition', 'Where', 'Carry (empty: the kind\'s usual)']);
});
