// The Assist safety net on the real host (MODULES §F123): held/dormant modules, restore barriers, replacement replies, cap, and afterCapture hooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTING } from '../../../modules/assist/index.js';
import { assistSections } from '../../../core/capture.js';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { OWNER, WORLD_PROBE, assistTypes, heldModel, hostWith, skip, wait } from './safety-net.helpers.js';

// A kind whose module is held back is told as held, not as an unknown kind; a truly unknown kind keeps its text.
test('a line of a kind whose module is dormant is a MODULE_HELD Problem (with a readable card reason), an unknown kind stays UNKNOWN_KIND', { skip }, async () => {
    const probe = { id: 'held-probe', version: '1.0.0', domains: { heldProbe: { initial: () => ({ said: [] }) } },
        capture: { kinds: { zed: { grammar: '+ zed Name' } }, apply(ctx, line) { ctx.draft('heldProbe').said.push(line.raw); return { narrate: false }; } } };
    const host = await createHost({ modules: [probe] });
    try {
        host.registry.setEnabled('held-probe', false, 'off for the test');
        const { index } = await host.send('b', 'ok\n<Changes>\n+ zed One\n+ nope Two\n</Changes>');
        const found = host.turn.problems().filter(item => item.index === index);
        assert.deepEqual(found.map(item => item.code), ['MODULE_HELD', 'UNKNOWN_KIND']);
        assert.match(found[0].message, /^"\+ zed One" was not used: held-probe is held back/);
        const { refusedFrom } = await import('../../../ui/legacy/reply-notes.js');
        assert.deepEqual(refusedFrom(found, index).map(item => item.reason), ['held-probe is held back right now (dormant, or a restore is in progress).', 'no module keeps "nope"']);
    } finally { host.close(); }
});

// The lead for the owner's UNKNOWN_KIND (13 Nov): the main block ran, then Story Director was held back (a restore barrier after an edit, Re-read
// or delete; or dormant) when the safety net's answer arrived. Its world/faction lines are refused visibly, never applied later.

test('a restore barrier when the safety net answers refuses each held line and releasing it never applies them', { skip }, async () => {
    const { announceModules } = await import('../../../core/sdk/lifecycle.js');
    const { model, release, calls: asked } = heldModel(OWNER.join('\n'));
    const calls = () => asked.length;
    const host = await createHost({ modules: [WORLD_PROBE], callModel: model, settings: { modules: { 'story-block': { [SETTING.extractor]: true, [SETTING.extractorKinds]: '~ time, + world, ~ world, + faction, ~ faction' } } } });
    host.features?.set?.('story-block.extractor', true);
    try {
        const sent = await host.send('I look around.', 'Red Cords lock the pier. Wolves are pushed onto the timber track.\n<Changes>\n~ weather mist\n</Changes>');
        host.registry.setRestore('pending', 'Restoring a save point.');
        announceModules(host.registry, host.events);
        assert.equal(host.registry.heldModules().includes('world-probe'), true);
        release();
        await wait(80);
        const record = () => host.ctx.chat[sent.index].extra.storySuite;
        const found = host.turn.problems().filter(item => item.index === sent.index && item.code === 'MODULE_HELD');
        assert.deepEqual(found.map(item => item.line), OWNER);
        assert.ok(found.every(item => /world-probe was held back \(Restoring a save point\.\); this line was not used\./.test(item.message)));
        assert.equal(host.turn.problems().some(item => item.index === sent.index && item.code === 'UNKNOWN_KIND'), false);
        assert.equal(record().receipts.some(receipt => /world|faction/.test(receipt.type)), false, 'nothing ran while it was held');
        assert.deepEqual(assistSections(host.ctx.chat[sent.index].mes).now, [], 'and nothing is stored as run');
        host.registry.setRestore('idle');
        announceModules(host.registry, host.events);
        await wait(120);
        assert.equal(record().receipts.some(receipt => /^capture\.(world|faction)$/.test(receipt.type)), false);
        assert.deepEqual(assistSections(host.ctx.chat[sent.index].mes).now, []);
        assert.deepEqual(host.store.at(sent.index).domains.worldProbe.said, []);
        // Re-read cannot apply a refused line and never makes another model call.
        const types = () => record().receipts.map(receipt => [receipt.type, receipt.assist]);
        const before = JSON.stringify(types()), callsBefore = calls();
        assert.equal((await host.sdk.reread(sent.index)).ok, true);
        assert.equal(JSON.stringify(types()), before);
        assert.equal(calls(), callsBefore);
        assert.deepEqual(host.store.at(sent.index).domains.worldProbe.said, []);
    } finally { host.close(); }
});

test('a dormant module held when an answer arrives during the next send reports even + lines and never applies them', { skip }, async () => {
    const { model, release } = heldModel(OWNER.join('\n'));
    const host = await createHost({ modules: [WORLD_PROBE], callModel: model, settings: { modules: { 'story-block': { [SETTING.extractor]: true, [SETTING.extractorKinds]: '+ world, + faction' } } } });
    host.features?.set?.('story-block.extractor', true);
    try {
        const first = await host.send('I look around.', 'Red Cords lock the pier.');
        host.registry.setEnabled('world-probe', false, 'Not ready.');
        const intercept = host.st.interceptor;
        host.st.interceptor = async (...args) => { await intercept(...args); release(); await wait(40); };
        await host.send('Go on.', 'The quay is still busy.');
        host.st.interceptor = intercept;
        const problems = host.turn.problems().filter(item => item.index === first.index && item.code === 'MODULE_HELD');
        assert.deepEqual(problems.map(item => item.line), OWNER);
        assert.ok(problems.every(item => /world-probe was held back \(Not ready\.\)/.test(item.message)));
        assert.deepEqual(assistSections(host.ctx.chat[first.index].mes), { now: [], next: [] });
        host.registry.setEnabled('world-probe', true);
        const { announceModules } = await import('../../../core/sdk/lifecycle.js');
        announceModules(host.registry, host.events);
        await wait(80);
        assert.deepEqual(host.head().domains.worldProbe.said, []);
        assert.equal(host.sdk.receipts().some(({ receipt }) => /capture\.(world|faction)/.test(receipt.type)), false);
    } finally { host.close(); }
});

test('the same lines with no barrier apply at once, marked as the safety net\'s', { skip }, async () => {
    const { model, release } = heldModel(OWNER.join('\n'));
    const host = await createHost({ modules: [WORLD_PROBE], callModel: model, settings: { modules: { 'story-block': { [SETTING.extractor]: true, [SETTING.extractorKinds]: '~ time, + world, + faction' } } } });
    host.features?.set?.('story-block.extractor', true);
    try {
        const sent = await host.send('I look around.', 'Red Cords lock the pier.');
        release();
        await wait(80);
        assert.equal(host.turn.problems().some(item => item.index === sent.index), false);
        assert.deepEqual(host.ctx.chat[sent.index].extra.storySuite.receipts.filter(receipt => /^capture\.(world|faction)$/.test(receipt.type)).map(receipt => receipt.assist), ['now', 'now']);
    } finally { host.close(); }
});

// Round 4 (REV-assistworld3 points 1-3): an answer belongs to the reply it was asked for, the cap counts the same lines live and on Re-read,
// and a held module's afterCapture hook refuses the safety net's lines before it could run.

test('a pending answer never attaches to a replacement reply at the same index and swipe (a quiet Problem, nothing stored or applied)', { skip }, async () => {
    const { model, calls, release } = heldModel('~ place Old Mill | kind: settlement');
    const host = await hostWith(model);
    try {
        const first = await host.send('I walk on.', 'You walk to the old mill.');
        await wait(5);
        assert.equal(calls.length, 1);
        const sid = host.store.carrierSid(first.index);
        const second = await host.regenerate('You turn back to the quay.');
        assert.equal(second.index, first.index, 'the same index and swipe');
        assert.notEqual(host.store.carrierSid(second.index), sid, 'a different reply');
        const place = JSON.stringify(host.sdk.query('scene.place'));
        release();
        await wait(60);
        assert.equal(JSON.stringify(host.sdk.query('scene.place')), place, 'the old answer changed nothing');
        assert.deepEqual(assistSections(host.ctx.chat[second.index].mes), { now: [], next: [] });
        assert.deepEqual(assistTypes(host, second.index), []);
        const quiet = host.turn.problems().filter(item => item.code === 'REPLY_CHANGED');
        assert.equal(quiet.length, 1);
        assert.equal(quiet[0].quiet, true);
        assert.equal(quiet[0].index, undefined, 'it names no reply, so it is never listed on the replacement');
    } finally { host.close(); }
});

test('the cap counts the previous reply\'s late line and this reply\'s safety-net lines the same live and on Re-read (cap 10)', { skip }, async () => {
    let release, calls = 0;
    const held = new Promise(resolve => { release = resolve; });
    const model = async () => { calls += 1; if (calls === 1) { await held; return '~ place Old Mill | kind: settlement'; } return calls === 2 ? '~ weather fog' : 'none'; };
    const host = await hostWith(model);
    host.settings.set(null, 'maxChangeLines', 10);
    try {
        const first = await host.send('I walk on.', 'You walk to the old mill.');
        await wait(5);
        const intercept = host.st.interceptor;
        host.st.interceptor = async (...args) => { await intercept(...args); release(); await wait(20); };
        const nine = Array.from({ length: 9 }, (_, n) => `+ present Guest${n}`);
        const second = await host.send('Go on.', `A crowd gathers.\n<Changes>\n${nine.join('\n')}\n</Changes>`);
        host.st.interceptor = intercept;
        await wait(80);
        assert.ok(assistSections(host.ctx.chat[first.index].mes).next.length, 'the late line was kept on the reply before');
        const types = () => host.ctx.chat[second.index].extra.storySuite.receipts.map(receipt => `${receipt.type}:${receipt.assist ?? ''}`);
        const live = JSON.stringify(types()), state = JSON.stringify(host.head().domains.scene);
        assert.ok(live.includes(':late'), 'the previous reply\'s line ran (the tenth)');
        assert.equal(host.turn.problems().some(item => item.index === second.index && item.code === 'TOO_MANY' && item.assist === 'now'), true, 'its own answer is told as over the cap');
        assert.equal(live.includes('weather'), false);
        assert.equal((await host.sdk.reread(second.index)).ok, true);
        assert.equal(JSON.stringify(types()), live, 'Re-read keeps exactly what live kept');
        assert.equal(JSON.stringify(host.head().domains.scene), state);
    } finally { host.close(); }
});

test('a held module with an afterCapture hook refuses the safety net\'s lines before any hook runs, with a visible reason, and Re-read agrees', { skip }, async () => {
    const { announceModules } = await import('../../../core/sdk/lifecycle.js');
    const probe = { id: 'hook-probe', version: '1.0.0', domains: { hookProbe: { initial: () => ({ n: 0 }) } }, hooks: { afterCapture: () => ({ commands: [] }) } };
    const { model, release } = heldModel('~ weather rain');
    const host = await createHost({ modules: [probe], callModel: model, settings: { modules: { 'story-block': { [SETTING.extractor]: true } } } });
    host.features?.set?.('story-block.extractor', true);
    try {
        const sent = await host.send('I look around.', 'Rain begins to fall.');
        host.registry.setRestore('pending', 'Restoring a save point.');
        announceModules(host.registry, host.events);
        release();
        await wait(80);
        const found = host.turn.problems().filter(item => item.index === sent.index && item.code === 'MODULE_HELD');
        assert.deepEqual(found.map(item => item.line), ['~ weather rain']);
        assert.match(found[0].message, /hook-probe was held back \(Restoring a save point\.\); this line was not used\./);
        assert.deepEqual(assistTypes(host, sent.index), []);
        assert.deepEqual(assistSections(host.ctx.chat[sent.index].mes), { now: [], next: [] });
        host.registry.setRestore('idle');
        announceModules(host.registry, host.events);
        const state = JSON.stringify(host.head().domains.scene);
        assert.equal((await host.sdk.reread(sent.index)).ok, true);
        assert.equal(JSON.stringify(host.head().domains.scene), state, 'Re-read after the release changes nothing');
        assert.deepEqual(assistTypes(host, sent.index), []);
    } finally { host.close(); }
});
