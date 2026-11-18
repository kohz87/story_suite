// LAB-2 (live A/B): a repaired time stretch over a day needs the reply to say a day or more passed; else it is cut to +24h with a Problems note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REPAIR_FOOT } from '../../../modules/assist/index.js';
import { capStretch, statesLongStretch } from '../../../modules/assist/repair-parts/time-cap.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { createHost } from '../../../testkit/index.js';
import { skip, wait } from './safety-net.helpers.js';

// The live reply (B, turn 6): first light to late afternoon of the second day; the repair wrote "! time +41h".
const T6 = 'You shook stiff frost off your wool blanket at first light and walked west toward Auvoth. By midmorning, your boots hammered out a steady pace across the empty gravel, though two full days of frontier road still lay between you and Auvoth\'s outer gates.\n\nYou walked on through the second day under a pale, cloudless sky while the sun slid lower ahead of you. Late in the afternoon, three collapsed brick domes rose beside a bend in the road.';
const DAY = 24 * 60;

test('a stretch over a day is cut to +24h when the reply does not say a day or more passed; the recorded T6 reply does not', () => {
    const cut = capStretch(['! time +41h', '+ present Haldor'], T6);
    assert.deepEqual(cut.lines, ['! time +24h', '+ present Haldor']);
    assert.deepEqual(cut.cut.map(item => item.line), ['! time +41h']);
    assert.match(cut.cut[0].why, /does not say a day or more passed/);
    assert.deepEqual(capStretch(['! time +2d'], T6).lines, ['! time +24h']);
    assert.equal(capStretch(['! time +24h', '! time +90m', '! time +1d'], T6).cut.length, 0, 'up to a day stands');
});

test('a reply that says a day or more passed keeps its long stretch', () => {
    for (const said of ['The next morning you woke stiff.', 'Two days later the gates came in sight.', 'You slept in the barn.', 'It rained overnight.']) {
        assert.deepEqual(capStretch(['! time +41h'], said), { lines: ['! time +41h'], cut: [] }, said);
    }
});

test('a long trip the reply states in days, weeks or a fortnight is never cut (LABFIX2); a distance still to cover or the second day is', () => {
    for (const said of ['After three days of hard riding they reached the gate.', 'They rode for a week and arrived.', 'On the third day they arrived at dusk.',
        'Three days on the road, and finally the gate.', 'Days later, the gate.', 'Two days passed.', 'After a fortnight the walls came in sight.', 'By the next evening they had crossed.', 'They walked for days.']) {
        assert.equal(statesLongStretch(said), true, said);
        assert.deepEqual(capStretch(['! time +72h'], said), { lines: ['! time +72h'], cut: [] }, said);
    }
    for (const unsaid of [T6, 'You walked on through the second day.', 'Two full days of road still lay ahead of you.', 'It took a day and a night to reach the pass, a day at most.']) {
        assert.equal(statesLongStretch(unsaid), false, unsaid);
        assert.deepEqual(capStretch(['! time +72h'], unsaid).lines, ['! time +24h'], unsaid);
    }
});

test('the repair foot tells the model to count only the narrated time and not to write a day without the reply saying so', () => {
    assert.match(REPAIR_FOOT, /a walk from first light to late afternoon is about ! time \+10h, never a day more/);
    assert.match(REPAIR_FOOT, /only when the reply says a day or more passed/);
});

async function directorHost(callModel) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ realDefaults: true, modules: [module], callModel });
    host.ctx.name1 = 'Astra';
    return host;
}

test('live: the recorded T6 reply moves the clock 24 hours, not 41, with a Problems note; swipe back, Re-read and reload keep it', { skip }, async () => {
    const host = await directorHost(async () => '<Changes>\n! time +41h\n</Changes>');
    await host.send('Hello.', 'Dawn.\n<Changes>\n~ time June 3, 1200, 07:00 am\n</Changes>');
    const before = host.sdk.query('time.now')?.minutes;
    const turn = await host.send('I walk on.', T6);
    await wait(60);
    const after = host.sdk.query('time.now')?.minutes;
    assert.equal(after - before, DAY);
    assert.ok(host.turn.problems().some(item => /does not say a day or more passed/.test(item.message)));
    await host.turn.onChatChanged();
    assert.equal(host.sdk.query('time.now')?.minutes, after, 'reload');
    await host.sdk.reread(turn.index);
    await wait(60);
    assert.equal(host.sdk.query('time.now')?.minutes, after, 'Re-read reads the stored, cut line');
    host.close();
});

// LAB2-4 (live A/B 2): "! time +10d" for a scene "after dusk" left the clock at 11:20 am; the repair now writes the stretch and the clock time.
const T8 = 'Ten days later you reached the Tallow Pint, the hearth already lit. After dusk the room filled with drovers shaking snow from their coats.';

test('the repair foot teaches the stretch and the clock time as a pair', () => {
    assert.match(REPAIR_FOOT, /"! time \+10d" then "~ time 7:00 pm"/);
});

test('live: a repaired "! time +10d" then "~ time 7:00 pm" lands on the evening; swipe back, Re-read and reload keep it', { skip }, async () => {
    const host = await directorHost(async () => '<Changes>\n! time +10d\n~ time 7:00 pm\n</Changes>');
    await host.send('Hello.', 'Dawn.\n<Changes>\n~ time June 3, 1200, 11:20 am\n</Changes>');
    const before = host.sdk.query('time.now')?.minutes;
    const turn = await host.send('I ride on.', T8);
    await wait(60);
    const after = host.sdk.query('time.now')?.minutes;
    assert.equal(after - before, 10 * DAY + (19 * 60 - (11 * 60 + 20)), 'ten days on, at 7:00 pm');
    assert.equal(host.turn.problems().some(item => /was not used|refused/.test(item.message)), false, 'the wall accepts the pair');
    await host.turn.onChatChanged();
    assert.equal(host.sdk.query('time.now')?.minutes, after, 'reload');
    await host.sdk.reread(turn.index);
    await wait(60);
    assert.equal(host.sdk.query('time.now')?.minutes, after, 'Re-read');
    host.close();
});
