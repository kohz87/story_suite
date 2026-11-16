// §2.2a "auto" on the waiting choice: the offer opens the choice, `open` + `auto` stages the reader's steps from the kind's own `auto` (a valid choice for
// the reader's actor), Send releases the held reply, and the settle replays the same on a swipe and on a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { hashText } from '../../../src/v2/assist/common.js';
import { readRecord } from '../../../src/v2/persist.js';
import { START_KINDS } from '../../../src/v2/interaction/start.js';
import { IA_KIND, activeSettles, box, iaApi, iaModule, withLines } from '../qa/helpers/probe-interaction.js';

const plain = value => JSON.parse(JSON.stringify(value));

test('the waiting choice played by auto: steps staged by the kind, sent, settled, and a swipe and a reload give the same result', async () => {
    START_KINDS.push(IA_KIND);
    const offer = { host: null, on: false };
    const hooks = { beforeGenerate(view, info) {
        if (!offer.on || info.type !== 'normal' || info.commit === false) return null;
        const chat = offer.host.ctx.chat;
        return { interactionStart: { kindId: IA_KIND, title: 'Probe', anchor: readRecord(chat.at(-2))?.sid, message: hashText(String(chat.at(-1).mes ?? '').trim()), choices: ['play', 'auto'], opening: { args: {} } } };
    } };
    const host = await createHost({ modules: [iaModule({ hooks })] });
    try {
        offer.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.on = true;
        host.st.addUser('I go.');
        assert.equal((await host.st.generate('normal', { reply: '' })).aborted, true, 'the offer holds the send');
        offer.on = false;
        const api = iaApi(host), id = api.open(IA_KIND).id;
        const played = api.auto(id, 1);
        assert.equal(played.ok, true, played.message);
        assert.equal(played.staged, 1, 'auto staged a step');
        const [staged] = box(host).open.steps;
        assert.deepEqual(staged.inputs.map(input => input.actor), ['hero'], 'only the reader chose; the companion is derived');
        assert.ok(['go', 'wait'].includes(staged.inputs[0].choice));
        assert.equal(api.send(id).ok, true);
        const done = await host.regenerate('He goes.');
        assert.equal(done.aborted, undefined);
        const settles = activeSettles(host);
        assert.deepEqual(settles.map(item => item.payload.opening === true), [true, false], 'the opening, then the auto segment');
        assert.deepEqual(settles[1].payload.steps, [staged]);
        assert.equal(settles[1].result.mate, 'hum');
        const bag = host.head().domains.ia.bag;
        await host.swipe('He goes, again.');
        assert.deepEqual(activeSettles(host).map(item => item.result), settles.map(item => item.result), 'a swipe settles the same');
        assert.equal(host.head().domains.ia.bag, bag);
        const live = plain(host.head());
        await host.turn.onChatChanged();
        assert.deepEqual(plain(host.head()), live, 'a reload gives the live state');
        assert.deepEqual(activeSettles(host).map(item => item.result), settles.map(item => item.result));
    } finally { START_KINDS.pop(); host.close(); }
});
