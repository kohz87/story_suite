// The Assist safety net on the real host (MODULES §F123): final-paragraph arrival guard (assistPresent) and momentary restore barriers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assistSections } from '../../../../../core/capture.js';
import { AT_VILLAGE, ERRAND_REPLY, OWNER, SAME_VILLAGE, assistTypes, barrierHost, heldModel, heldProblems, hostWith, settleTurn, skip, wait } from './safety-net.helpers.js';

test('a same-place safety-net answer cannot add someone met on the way; the final scene survives Re-read and reload', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 2 ? `${SAME_VILLAGE}\n+ present Gerrit` : 'none'));
    try {
        await host.send('At the guild.', AT_VILLAGE);
        const settled = settleTurn(host);
        const reply = await host.send('Run the errands.', ERRAND_REPLY);
        const result = await settled;
        assert.equal(host.sdk.query('scene.place').name, 'Bluewatch Village');
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
        assert.ok(host.ctx.chat[reply.index].extra.storySuite.rules.includes('assistPresent'));
        assert.deepEqual(assistSections(host.ctx.chat[reply.index].mes).now, [SAME_VILLAGE]);
        assert.ok(result.problems.some(item => item.line === '+ present Gerrit' && item.code === 'REFUSED' && /Gerrit.*not named in the reply's last paragraph/.test(item.message)));
        const scene = JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]);
        assert.equal((await host.sdk.reread(reply.index)).ok, true);
        assert.equal(JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]), scene);
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.equal(JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]), scene);
    } finally { host.close(); }
});

test('the guard keeps final-paragraph arrivals, departures, new moves and answers with no place line', { skip }, async () => {
    const cases = [
        { answer: `+ present Gerrit\n- present Sieke\n${SAME_VILLAGE}`, story: `${ERRAND_REPLY} GERRIT's bowl is on the desk.`, present: ['Gerrit', 'Sister Temiwa'], place: 'Bluewatch Village' },
        { answer: '+ present Gerrit\n~ place Guild Office', story: ERRAND_REPLY, present: ['Gerrit', 'Sieke', 'Sister Temiwa'], place: 'Guild Office' },
        { answer: '+ present Gerrit', story: ERRAND_REPLY, present: ['Gerrit', 'Sieke', 'Sister Temiwa'], place: 'Bluewatch Village' },
    ];
    for (const sample of cases) {
        let calls = 0;
        const host = await hostWith(async () => (++calls === 2 ? sample.answer : 'none'));
        try {
            await host.send('At the guild.', AT_VILLAGE);
            const settled = settleTurn(host);
            const reply = await host.send('Go.', sample.story);
            const result = await settled;
            assert.deepEqual(host.sdk.query('scene.present').sort(), sample.present, sample.answer);
            assert.equal(host.sdk.query('scene.place').name, sample.place);
            assert.ok(!result.problems.some(item => item.line === '+ present Gerrit' && item.code === 'REFUSED'));
            assert.equal((await host.sdk.reread(reply.index)).ok, true);
            assert.deepEqual(host.sdk.query('scene.present').sort(), sample.present);
        } finally { host.close(); }
    }
});

test('whole names are checked in the last story paragraph, and a mixed arrival keeps the names in the final scene', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 2 ? `+ present Gerrit, Sister Temiwa\n${SAME_VILLAGE}` : 'none'));
    try {
        await host.send('At the guild.', 'Sieke waits.\n<Changes>\n~ place Bluewatch Village | kind: settlement | region: Bluewatch | with: Sieke\n</Changes>');
        const settled = settleTurn(host);
        const reply = await host.send('Return.', `${ERRAND_REPLY} Gerritson waits.\n<think>Gerrit is here.</think>\n<Changes>\n~ weather clear\n</Changes>`);
        const result = await settled;
        assert.ok(result.problems.some(item => item.line === '+ present Gerrit, Sister Temiwa' && /Gerrit is not named/.test(item.message) && !/Temiwa is not/.test(item.message)));
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
        assert.ok(assistSections(host.ctx.chat[reply.index].mes).now.includes('+ present Sister Temiwa'));
        assert.ok(!assistSections(host.ctx.chat[reply.index].mes).now.some(line => /Gerrit/.test(line)));
        assert.equal((await host.sdk.reread(reply.index)).ok, true);
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
    } finally { host.close(); }
});

test('a refused person does not come back through the place line\'s with: list; valid companions stay', { skip }, async () => {
    for (const answer of [`~ place Bluewatch Village | kind: settlement | with: Gerrit\n+ present Gerrit`, '~ place Bluewatch Village | kind: settlement | with: Gerrit, Sister Temiwa']) {
        let calls = 0;
        const host = await hostWith(async () => (++calls === 2 ? answer : 'none'));
        try {
            await host.send('At the guild.', 'Sieke waits.\n<Changes>\n~ place Bluewatch Village | kind: settlement | region: Bluewatch | with: Sieke\n</Changes>');
            const settled = settleTurn(host);
            const reply = await host.send('Return.', ERRAND_REPLY);
            const result = await settled;
            assert.ok(result.problems.some(item => item.code === 'REFUSED' && /Gerrit is not named/.test(item.message)), answer);
            const present = answer.includes('Temiwa') ? ['Sieke', 'Sister Temiwa'] : ['Sieke'];
            assert.deepEqual(host.sdk.query('scene.present').sort(), present, answer);
            assert.ok(!assistSections(host.ctx.chat[reply.index].mes).now.some(line => /Gerrit/.test(line)));
            assert.equal((await host.sdk.reread(reply.index)).ok, true);
            assert.deepEqual(host.sdk.query('scene.present').sort(), present);
            await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
            assert.deepEqual(host.sdk.query('scene.present').sort(), present);
        } finally { host.close(); }
    }
});

test('a deferred answer with a with: list is judged the same way', { skip }, async () => {
    const held = heldModel('~ place Bluewatch Village | kind: settlement | with: Gerrit, Sister Temiwa');
    let calls = 0;
    const host = await hostWith(async prompt => (++calls === 2 ? held.model(prompt) : 'none'));
    try {
        await host.send('At the guild.', 'Sieke waits.\n<Changes>\n~ place Bluewatch Village | kind: settlement | region: Bluewatch | with: Sieke\n</Changes>');
        const source = await host.send('Run the errands.', ERRAND_REPLY);
        await wait(5);
        const intercept = host.st.interceptor;
        host.st.interceptor = async (...args) => { await intercept(...args); held.release(); await wait(20); };
        const next = await host.send('Enter.', 'Nothing else happens.');
        host.st.interceptor = intercept;
        assert.deepEqual(assistSections(host.ctx.chat[source.index].mes).next, ['~ place Bluewatch Village | kind: settlement | with: Sister Temiwa']);
        assert.ok(host.turn.problems().some(item => item.index === source.index && item.code === 'REFUSED' && /Gerrit is not named/.test(item.message)));
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
        assert.equal((await host.sdk.reread(next.index)).ok, true);
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
    } finally { host.close(); }
});

test('a duplicate safety-net place removed before capture still guards an arrival', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 2 ? `${SAME_VILLAGE}\n+ present Gerrit\n~ weather rain` : 'none'));
    try {
        await host.send('At the guild.', AT_VILLAGE);
        const settled = settleTurn(host);
        const reply = await host.send('Return.', `${ERRAND_REPLY}\n<Changes>\n${SAME_VILLAGE}\n</Changes>`);
        const result = await settled;
        assert.ok(result.problems.some(item => item.line === '+ present Gerrit' && item.code === 'REFUSED'));
        assert.deepEqual(assistSections(host.ctx.chat[reply.index].mes).now, ['~ weather rain']);
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
    } finally { host.close(); }
});

test('an arrival is refused when the safety-net place conflicts with the reply or the place handler rejects it', { skip }, async () => {
    for (const place of ['~ place Bluewatch Outskirts', `~ place Guild Office | kind: ${'x'.repeat(81)}`]) {
        let calls = 0;
        const host = await hostWith(async () => (++calls === 2 ? `+ present Gerrit\n${place}` : 'none'));
        try {
            await host.send('At the guild.', AT_VILLAGE);
            const settled = settleTurn(host);
            const reply = await host.send('Return.', `${ERRAND_REPLY}\n<Changes>\n+ present Dries | at: Guild Office\n</Changes>`);
            const result = await settled;
            assert.ok(result.problems.some(item => item.line === '+ present Gerrit' && item.code === 'REFUSED'), place);
            assert.ok(result.problems.some(item => item.line === place), place);
            assert.deepEqual(host.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
            assert.ok(!assistSections(host.ctx.chat[reply.index].mes).now.includes('+ present Gerrit'));
            assert.equal((await host.sdk.reread(reply.index)).ok, true);
            assert.deepEqual(host.sdk.query('scene.present').sort(), ['Dries', 'Sieke', 'Sister Temiwa']);
        } finally { host.close(); }
    }
});

test('a deferred same-place answer checks the source reply before storing lines for the next reply', { skip }, async () => {
    const held = heldModel(`+ present Gerrit\n${SAME_VILLAGE}`);
    let calls = 0;
    const host = await hostWith(async prompt => (++calls === 2 ? held.model(prompt) : 'none'));
    try {
        await host.send('At the guild.', AT_VILLAGE);
        const source = await host.send('Run the errands.', ERRAND_REPLY);
        await wait(5);
        const intercept = host.st.interceptor;
        host.st.interceptor = async (...args) => { await intercept(...args); held.release(); await wait(20); };
        const next = await host.send('Enter.', 'Gerrit is only mentioned in this later reply.');
        host.st.interceptor = intercept;
        assert.deepEqual(assistSections(host.ctx.chat[source.index].mes).next, [SAME_VILLAGE]);
        assert.ok(host.turn.problems().some(item => item.index === source.index && item.line === '+ present Gerrit' && item.code === 'REFUSED'));
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
        assert.equal((await host.sdk.reread(next.index)).ok, true);
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Sieke', 'Sister Temiwa']);
    } finally { host.close(); }
});

test('a reply without assistPresent keeps its earlier safety-net arrival through Re-read and reload', { skip }, async () => {
    let calls = 0;
    const host = await hostWith(async () => (++calls === 2 ? `${SAME_VILLAGE}\n+ present Gerrit` : 'none'));
    try {
        await host.send('At the guild.', AT_VILLAGE);
        const setter = host.store.setRuleMarks;
        host.store.setRuleMarks = (index, names) => setter(index, names.filter(name => name !== 'assistPresent'));
        const settled = settleTurn(host);
        const reply = await host.send('Run the errands.', ERRAND_REPLY);
        await settled;
        host.store.setRuleMarks = setter;
        assert.ok(!host.ctx.chat[reply.index].extra.storySuite.rules.includes('assistPresent'));
        assert.deepEqual(host.sdk.query('scene.present').sort(), ['Gerrit', 'Sieke', 'Sister Temiwa']);
        assert.ok(assistSections(host.ctx.chat[reply.index].mes).now.includes('+ present Gerrit'));
        const scene = JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]);
        assert.equal((await host.sdk.reread(reply.index)).ok, true);
        assert.equal(JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]), scene);
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.equal(JSON.stringify([host.sdk.query('scene.place'), host.sdk.query('scene.present')]), scene);
    } finally { host.close(); }
});

// The owner's play bug (14 Nov 02:30): the safety net's answer arrives right after the reply, when the timeline's momentary barrier ("a native
// change is finishing") is up, and its world/faction lines were refused almost every time. A momentary hold is waited for (bounded), then the
// same checks apply; a real restore or a dormant module is still refused at once.

test('a momentary barrier that clears within the bound: the safety net\'s world lines are applied, and Re-read gives the same', { skip }, async () => {
    const { host, release, setBarrier } = await barrierHost(OWNER.join('\n'));
    try {
        const sent = await host.send('I look around.', 'Red Cords lock the pier. Wolves are pushed onto the timber track.\n<Changes>\n~ weather mist\n</Changes>');
        setBarrier(true);
        release();
        await wait(60);
        assert.deepEqual(host.store.at(sent.index).domains.worldProbe.said, [], 'still waiting while the barrier is up');
        setBarrier(false);
        await wait(150);
        assert.deepEqual(heldProblems(host, sent.index), []);
        assert.deepEqual(host.store.at(sent.index).domains.worldProbe.said, OWNER);
        const stored = assistSections(host.ctx.chat[sent.index].mes);
        assert.deepEqual(stored.now, OWNER);
        const types = () => assistTypes(host, sent.index);
        const before = JSON.stringify(types());
        assert.equal((await host.sdk.reread(sent.index)).ok, true);
        assert.equal(JSON.stringify(types()), before, 'Re-read applies the same lines');
        assert.deepEqual(host.store.at(sent.index).domains.worldProbe.said, OWNER);
    } finally { host.close(); }
});

test('a momentary barrier that never clears: refused with its reason after the bound, and releasing it later applies nothing', { skip }, async () => {
    const { host, release, setBarrier } = await barrierHost(OWNER.join('\n'), { waitMs: 150 });
    try {
        const sent = await host.send('I look around.', 'Red Cords lock the pier.');
        setBarrier(true);
        release();
        await wait(400);
        const found = heldProblems(host, sent.index);
        assert.deepEqual(found.map(item => item.line), OWNER);
        assert.ok(found.every(item => /world-probe was held back \(A native change is finishing/.test(item.message)));
        setBarrier(false);
        await wait(120);
        assert.deepEqual(host.store.at(sent.index).domains.worldProbe.said, []);
        assert.deepEqual(assistSections(host.ctx.chat[sent.index].mes), { now: [], next: [] });
    } finally { host.close(); }
});

test('a reply swiped while the safety net waits for the barrier: its lines are dropped (a quiet Problem), never parked', { skip }, async () => {
    const { host, release, setBarrier } = await barrierHost(OWNER.join('\n'));
    try {
        const first = await host.send('I look around.', 'Red Cords lock the pier.');
        setBarrier(true);
        release();
        await wait(40);
        const second = { index: first.index };
        host.ctx.chat[first.index].swipe_id = 1;   // swiped to another version while the lines wait
        setBarrier(false);
        await wait(150);
        assert.deepEqual(host.store.at(second.index).domains.worldProbe.said, []);
        assert.deepEqual(assistSections(host.ctx.chat[second.index].mes), { now: [], next: [] });
        assert.equal(host.turn.problems().filter(item => item.code === 'REPLY_CHANGED').length, 1);
        assert.deepEqual(heldProblems(host, second.index), []);
    } finally { host.close(); }
});
