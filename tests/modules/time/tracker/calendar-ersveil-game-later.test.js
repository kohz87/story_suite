// S2PB B7: a chat begun on the Ersveil world with the built-in game keeps "CY 611" after the Ersveil game is installed and selected later,
// through an edited Re-read, a reload and a swipe (the pair from examples/packs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';

const pack = name => JSON.parse(readFileSync(new URL(`../../../../examples/packs/${name}/pack.json`, import.meta.url), 'utf8'));
const said = (text, line = '+ coin 5 | from: Bob') => `${text}\n\n<Changes>\n${line}\n</Changes>`;

test('S2PB B7: the era of a chat begun with the built-in game survives installing the Ersveil game; Re-read, swipe and reload agree', async t => {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), query: (name, args) => host?.sdk.query(name, args), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    t.after(() => host.close());
    assert.equal((await host.packs.packs.install(pack('ersveil'))).ok, true);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    assert.equal(host.head().domains.frame.game, 'built-in');
    const era = () => host.sdk.query('director.calendar').era;
    assert.equal(era(), 'CY');
    const game = pack('ersveil-game');
    assert.equal((await host.packs.packs.install(game)).ok, true);
    assert.equal(await host.packs.packs.select('game', game.id), true);
    assert.equal(era(), 'CY', 'right after the install');
    await host.st.editMessage(2, said('A longer first reply.', '+ coin 10 | from: Bob\n+ coin 20 | from: Bob'));
    assert.equal((await host.sdk.reread(2)).ok, true);
    assert.equal(era(), 'CY', 'after an edited Re-read');
    assert.match(host.sdk.query('director.time').text, /^CY 611, October 1/);
    await host.swipe(said('R2 again.'));
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    host.store.rebuild();
    assert.equal(era(), 'CY', 'swipe, swipe back, reload');
});
