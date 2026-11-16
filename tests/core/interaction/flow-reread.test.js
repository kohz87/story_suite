// §2.2 "Re-read" and "Re-read of the anchor while a session is staged": the settle is planned again from its stored payload (the recorded player,
// the stored seed and steps, the stored witness), also when the reply's text was edited longer or shorter; the staged session belongs to the next reply and is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { GO, activeSettles, box, codes, iaApi, iaChain, iaModule, setText, withLines } from '../../suite/qa/helpers/probe-interaction.js';

test('a Re-read plans the settle again from its stored payload: same result, same change, applied once', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = activeSettles(host)[0], bag = host.head().domains.ia.bag;
        assert.equal((await host.turn.reread(s[0])).ok, true);
        assert.deepEqual(activeSettles(host), [before]);
        assert.equal(host.head().domains.ia.bag, bag);
    } finally { host.close(); }
});

test('an edited Re-read, grown and then shrunk, keeps the same settle', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = activeSettles(host)[0];
        setText(host, s[0], withLines('S1, with more words.', ['! ia luck1', '! ia lamp1']));
        assert.equal((await host.turn.reread(s[0])).ok, true);
        assert.deepEqual(activeSettles(host), [before], 'grown: the settle block is the one it was');
        assert.equal(host.head().domains.ia.luck, 1, 'the new lines ran after it');
        setText(host, s[0], 'S1.');
        assert.equal((await host.turn.reread(s[0])).ok, true);
        assert.deepEqual(activeSettles(host), [before], 'shrunk: still the same block');
        assert.equal(host.head().domains.ia.luck, 0);
    } finally { host.close(); }
});

test('a persona rename between stage and Re-read replays the recorded player', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = activeSettles(host)[0];
        assert.equal(before.payload.player, 'hero');
        host.ctx.name1 = 'Zed';   // no actor of the kind is called that any more
        api.discard(box(host).open.id);
        assert.equal(api.stage(api.open('ia-probe/probe').id, GO).code, 'NOT_YOURS', 'an interaction opened now would find no player');
        assert.equal((await host.turn.reread(s[0])).ok, true);
        assert.deepEqual(activeSettles(host), [before], 'the Re-read replays the recorded player, not today\'s persona');
        assert.equal(codes(host).includes('INTERACTION_TAKEN_BACK'), false);
    } finally { host.close(); }
});

test('a Re-read re-checks payload.witness: a settle whose anchor now says another lamp is taken back', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { a } = await iaChain(host, api, { segments: 1 });
        setText(host, a, withLines('A.', ['! ia lamp3']));
        assert.equal((await host.turn.reread(a)).ok, true);
        assert.equal(activeSettles(host).length, 0);
        assert.equal(codes(host).filter(code => code === 'INTERACTION_TAKEN_BACK').length, 1);
    } finally { host.close(); }
});

test('a Re-read of the anchor keeps the staged session; what it read changing makes the next stage answer CHANGED', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        const id = api.open('ia-probe/probe').id;
        assert.equal(api.stage(id, GO).ok, true);
        setText(host, 2, withLines('A, said again.', ['! ia lamp1']));
        assert.equal((await host.turn.reread(2)).ok, true);
        assert.equal(box(host).open.steps.length, 1, 'the staged session survives the Re-read of its anchor');
        setText(host, 2, withLines('A.', ['! ia lamp2']));
        assert.equal((await host.turn.reread(2)).ok, true);
        assert.equal(box(host).open.steps.length, 1, 'still kept');
        assert.equal(api.stage(id, GO).code, 'CHANGED');
        host.st.addUser('x');
        assert.equal(api.send(id).code, 'CHANGED');
    } finally { host.close(); }
});
