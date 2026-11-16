// The page's own Fight board on a v1 fight: it opens, draws the kind's view with no call to the old engine, takes a hero's pick and target, stages one step and shows the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardView } from '../../../../modules/rpg/board/view.js';
import { boardApi } from '../../../core/helpers/board-port.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { page } from '../view/page.js';
import { v1Host, openFight, headSid } from './v1.helpers.js';

test('a v1 fight plays on the page\'s Fight board: draw, pick, target, stage, Auto, end', async t => {
    const restore = seedCrypto(11);
    t.after(restore);
    const { doc } = await page(t, { formula: 'standard' });
    const { host } = await v1Host({ count: 2, level: 3 });
    const meta = host.ctx.chatMetadata;
    const stored = () => JSON.stringify(meta.storySuiteInteraction.open.setup);
    const board = createBoardView({ doc, headState: () => host.head(), meta: () => meta, store: host.store, interaction: boardApi(meta, () => host.head(), headSid(host)), rules: () => ({ formula: 'standard' }),
        query: (name, args) => host.sdk.query(name, args), readerName: () => 'Astra', levels: () => ({ ranks: [], playerRank: null }), on: () => true });
    t.after(() => board.destroy());
    assert.equal(openFight(host).ok, true);
    const before = stored(), root = doc.createElement('div');
    doc.body.appendChild(root);
    const draw = () => { root.replaceChildren(); const snapshot = board.snapshot(host.head()); assert.equal(snapshot.played.error, undefined, snapshot.played.error); board.render(root, snapshot, draw, [], {}); };
    draw();
    assert.equal(stored(), before, 'drawing writes nothing into the stored v1 setup');
    assert.match(root.textContent, /Astra: choose an action/u);
    assert.match(root.textContent, /Rats 1/u);
    const tap = label => { const node = [...root.querySelectorAll('button')].find(button => button.textContent.startsWith(label)); assert.ok(node, `a "${label}" button`); node.click(); };
    tap('Attack');
    assert.match(root.textContent, /Choose a target/u);
    tap('Rats 2');
    assert.match(root.textContent, /Exchange 1/u, 'the exchange is staged and in the log');
    assert.equal(meta.storySuiteInteraction.open.steps.length, 1);
    assert.equal(stored(), before);
    for (let guard = 0; guard < 40 && !/Fight (won|lost)/u.test(root.textContent); guard += 1) {
        if (root.querySelector('.rpg-board-auto')) root.querySelector('.rpg-board-auto').click(); else break;
    }
    assert.match(root.textContent, /Fight (won|lost|fled)/u, 'Auto plays it to its end');
});

test('a v1 view without the fight shape (the kind\'s view threw) draws the error and does not throw', async t => {
    const { doc } = await page(t, { formula: 'standard' });
    const { host } = await v1Host({ count: 2, level: 3 });
    const meta = host.ctx.chatMetadata;
    const real = boardApi(meta, () => host.head(), headSid(host));
    const interaction = { ...real, current: () => ({ ...real.current(), view: { result: { outcome: 'x' } } }) };
    const board = createBoardView({ doc, headState: () => host.head(), meta: () => meta, store: host.store, interaction, rules: () => ({ formula: 'standard' }),
        query: (name, args) => host.sdk.query(name, args), readerName: () => 'Astra', levels: () => ({ ranks: [], playerRank: null }), on: () => true });
    t.after(() => board.destroy());
    assert.equal(openFight(host).ok, true);
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    const snapshot = board.snapshot(host.head());
    assert.equal(snapshot.played.error, 'The fight could not be played.');
    board.render(root, snapshot, () => {}, [], {});
    assert.match(root.textContent, /could not be played/u);
});
