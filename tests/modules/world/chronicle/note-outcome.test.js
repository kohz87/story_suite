// A thread's outcome line in the quest history on the real host (`chronicle.threadOutcome`, called inside the capture that
// resolves an accepted goal): it is kept under its reply's key with the revision it was told at, next to the note's line of
// that reply (the note no longer replaces it), and an edited Re-read of that reply with more lines, while later replies'
// notes are stored, is taken (it used to be refused: the capture's revision key met a later reply's stored note key).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/host.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { withD1 } from '../../../helpers/director/d1.js';
import { pad, said } from './note-cursor.helpers.js';

const id = 'th_00000001';

async function resolved(t, later = 0) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [withD1(createModule())] });
    t.after(() => host.close());
    await host.send('Tell me about the mill.', said('R0.', ['~ time June 3, 1200, 06:00 pm']));
    const offered = await host.sdk.command('threads.offer', { write: 'wr_00000001', thread: id, kind: 'hook', key: 'The mill', summary: 'Help the miller', fields: { goal: 'Talk to the miller' }, expectedHash: null });
    assert.equal(offered.ok, true);
    await host.send("Yes, I'll help, no problem.", said('R1.', ['~ hook The mill | progress: listening']));
    assert.ok(host.sdk.query('director.thread', { id }).acceptance);
    await host.send('Done.', said('R2.', ['- hook The mill — the miller is safe']));
    for (let k = 3; k < 3 + later; k += 1) await host.send('Next.', said(`R${k}.`, [`~ hook The mill | note: n${k}`, `~ place Harrow${k}`]));
    return host;
}
const log = host => host.head().domains.chronicle.questLog;
const outcomes = host => Object.entries(log(host)).filter(([, entry]) => entry.text === 'The mill: done.');
const history = host => host.sdk.query('chronicle.questLog', { id }).map(entry => entry.text);
const rebuildSame = host => { const before = JSON.stringify(host.head().domains.chronicle); host.store.rebuild(); return JSON.stringify(host.head().domains.chronicle) === before; };

test('the outcome is kept under its reply key with its revision, after the note\'s line of that reply', async t => {
    const host = await resolved(t, 2);
    assert.equal(host.sdk.query('director.thread', { id }).status, 'resolved');
    const [[key, entry]] = outcomes(host);
    assert.match(key, /^[A-Za-z][\w:-]*\.\d+$/);
    const line = Object.entries(log(host)).find(([, item]) => item.text === '- hook The mill — the miller is safe');
    assert.equal(entry.rev, Number(line[0]));
    assert.deepEqual(history(host).slice(-3), ['- hook The mill — the miller is safe', 'The mill: done.', '~ hook The mill | note: n3']);
    assert.equal(rebuildSame(host), true);
});

test('an edited Re-read of the resolving reply with more lines, later notes stored: taken, the outcome kept once', async t => {
    const host = await resolved(t, 3);
    const index = host.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith('R2.'));
    await host.st.editMessage(index, said('R2.', [...pad(8), '- hook The mill — the miller is safe']));
    const res = await host.sdk.reread(index);
    assert.equal(res.ok, true, res.message);
    assert.equal(outcomes(host).length, 1);
    assert.match(outcomes(host)[0][0], /^[A-Za-z]/);
    assert.equal(history(host).filter(text => text === '~ hook The mill | note: n4').length, 1);
    assert.equal(rebuildSame(host), true);
});

test('a swipe of the resolving reply takes its outcome away; a delete of it too', async t => {
    const swiped = await resolved(t);
    await swiped.swipe(said('R2 again.', ['~ hook The mill | progress: walking']));
    assert.equal(outcomes(swiped).length, 0);
    assert.equal(rebuildSame(swiped), true);
    const deleted = await resolved(t, 1);
    const index = deleted.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith('R2.'));
    await deleted.st.deleteMessage(index); await deleted.st.deleteMessage(index - 1);
    assert.equal(outcomes(deleted).length, 0);
    assert.equal(rebuildSame(deleted), true);
});
