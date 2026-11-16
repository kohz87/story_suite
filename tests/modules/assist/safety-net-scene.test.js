// The Assist safety net on the real host (MODULES §F123): scene destinations, intermediate stops, departures, and assistPlace marks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_REPLY, WRONG_STOP, heldModel, hostWith, skip, wait } from './safety-net.helpers.js';

test('the creek to Guild reply refuses the intermediate stop and keeps all three people, including on the next reply and Re-read', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 1 ? 'none' : WRONG_STOP));
    await host.send('At the creek.', 'You wait by Eastern Creek.\n<Changes>\n~ place Bluewatch Outskirts / Eastern Creek | with: Sieke, Sister Temiwa\n</Changes>');
    let applied = new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
    const reply = await host.send('Return to the guild.', OFFICE_REPLY);
    let result = await applied;
    assert.equal(host.sdk.query('scene.place').name, 'Bluewatch Outskirts / Eastern Creek', 'the unsupported stop is not installed');
    assert.deepEqual(host.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
    assert.ok(result.problems.some(item => item.code === 'REFUSED' && /Dries/.test(item.message)), JSON.stringify(result.problems));
    assert.ok(!result.receipts.some(item => item.assistLine === WRONG_STOP));
    const again = await host.sdk.reread(reply.index);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(host.sdk.query('scene.place').name, 'Bluewatch Outskirts / Eastern Creek');
    assert.deepEqual(host.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
    applied = new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
    host.close();
});

test('the creek to Guild reply with the right destination moves there (Dries is already there, not in with:), keeps all three, and agrees on Re-read', { skip }, async () => {
    const right = '~ place Bluewatch Village / Guild Office | with: Sister Temiwa';
    let calls = 0;
    const host = await hostWith(async () => (++calls === 1 ? 'none' : right));
    await host.send('At the creek.', 'You wait by Eastern Creek.\n<Changes>\n~ place Bluewatch Outskirts / Eastern Creek | with: Sieke, Sister Temiwa\n</Changes>');
    const applied = new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
    const reply = await host.send('Return to the guild.', OFFICE_REPLY);
    await applied;
    assert.equal(host.sdk.query('scene.place').name, 'Bluewatch Village / Guild Office');
    assert.deepEqual(host.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
    const live = JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]);
    const again = await host.sdk.reread(reply.index);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]), live, 'Re-read: the same whole scene as live');
    host.close();
});

test('a sibling destination is refused, an alias of the right one is accepted', { skip }, async () => {
    for (const [line, place] of [['~ place Bluewatch Village / Market | with: Sister Temiwa', 'Bluewatch Outskirts / Eastern Creek'], ['~ place Bluewatch Village / Guild Office | with: Sister Temiwa', 'Bluewatch Village / Guild Office']]) {
        let calls = 0;
        const host = await hostWith(async () => (++calls === 1 ? 'none' : line));
        await host.send('At the creek.', 'You wait by Eastern Creek.\n<Changes>\n~ place Bluewatch Outskirts / Eastern Creek | with: Sieke, Sister Temiwa\n</Changes>');
        const applied = new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
        await host.send('Return.', OFFICE_REPLY);
        await applied;
        assert.equal(host.sdk.query('scene.place').name, place, line);
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
        host.close();
    }
});

test('a Continue that adds an arrival does not undo a kept Assist move on Re-read (the decision made at capture stands)', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 2 ? '~ place Guild Office | with: Sister Temiwa' : 'none'));
    await host.send('At the creek.', 'Sieke and Temiwa are here.\n<Changes>\n~ place Creek | with: Sieke, Sister Temiwa\n</Changes>');
    const applied = new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
    const reply = await host.send('Go.', 'You reach the Guild office.');
    await applied;
    assert.equal(host.sdk.query('scene.place').name, 'Guild Office');
    const message = host.ctx.chat[reply.index];
    message.mes = message.mes.replace('You reach the Guild office.', 'You reach the Guild office. Dries waits.\n<Changes>\n+ present Dries | at: Market\n</Changes>');
    if (Array.isArray(message.swipes)) message.swipes[message.swipe_id ?? 0] = message.mes;
    const again = await host.sdk.reread(reply.index);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(host.sdk.query('scene.place').name, 'Guild Office', 'the move kept at capture is not refused later');
    host.close();
});

test('a departure inside the same Assist answer is not undone by its place line, now and late, and Re-read agrees', { skip }, async () => {
    const answer = '- present Watch\n~ place Guild Office | with: Sister Temiwa, Watch';
    const creek = 'Sieke and Watch are here.\n<Changes>\n~ place Creek | with: Sieke, Watch\n</Changes>';
    const settled = host => new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
    // Now: the answer is read within the send.
    let calls = 0;
    const now = await hostWith(async () => (++calls === 2 ? answer : 'none'));
    await now.send('At the creek.', creek);
    const applied = settled(now);
    const reply = await now.send('Go.', 'You reach the Guild office with Temiwa.');
    await applied;
    assert.deepEqual(now.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
    const again = await now.sdk.reread(reply.index);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.deepEqual(now.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
    now.close();
    // Late: the answer arrives while the next reply is written and is applied after its lines.
    const held = heldModel(answer);
    let more = 0;
    const late = await hostWith(async prompt => (++more === 2 ? held.model(prompt) : 'none'));
    await late.send('At the creek.', creek);
    await late.send('Go.', 'You reach the Guild office with Temiwa.');
    await wait(5);
    const intercept = late.st.interceptor;
    late.st.interceptor = async (...args) => { await intercept(...args); held.release(); await wait(20); };
    const next = await late.send('Enter.', 'Dries arrives.\n<Changes>\n+ present Dries\n</Changes>');
    late.st.interceptor = intercept;
    assert.equal(late.sdk.query('scene.place').name, 'Guild Office');
    assert.deepEqual(late.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
    const reread = await late.sdk.reread(next.index);
    assert.equal(reread.ok, true, JSON.stringify(reread));
    assert.deepEqual(late.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
    late.close();
});

test('an old reply (carrying the earlier rule marks, not assistPlace) keeps the former move byte for byte on live and Re-read', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 2 ? '~ place Guild Office | with: Sister Temiwa' : 'none'));
    await host.send('At the creek.', 'Sieke and Temiwa are here.\n<Changes>\n~ place Creek | with: Sieke, Sister Temiwa\n</Changes>');
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = (index, names) => setter(index, names.filter(name => name !== 'assistPlace'));
    const applied = new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));
    const reply = await host.send('Go.', 'You arrive at the office.\n<Changes>\n+ present Dries | at: Market\n</Changes>');
    await applied;
    host.store.setRuleMarks = setter;
    const record = host.ctx.chat[reply.index].extra.storySuite;
    assert.ok(!record.rules?.includes('assistPlace'));
    const former = { place: 'Guild Office', present: ['Sister Temiwa'] };
    const state = () => ({ place: host.sdk.query('scene.place').name, present: host.sdk.query('scene.present') });
    assert.deepEqual(state(), former);
    const live = JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]);
    const again = await host.sdk.reread(reply.index);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.deepEqual(state(), former);
    assert.equal(JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]), live, 'whole scene byte-identical');
    host.close();
});
