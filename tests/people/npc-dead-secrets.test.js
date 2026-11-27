// A dead person's own hidden notes (real adapter, lines mode on; the live list marks the dead archived, as NPC State's does): a `~ reveal` line or a story event
// opens one; no meter opens any, their meters, stages and ladder stay as they are, and a living namesake's or alias holder's notes are never used for them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { castWith, note, person } from './npc-alias-lines.helpers.js';
import { dossierMap } from '../../ui/select/people-parts.js';
import { STAGES } from './storysuite-v2-meters.helpers.js';

const EVENT_ID = 'sec_cccccccc';
const METER_ID = 'sec_dddddddd';
const TOLD = { id: EVENT_ID, title: 'The oar', when: 'the oar is found', text: 'Ana keeps a spare oar.', from: 'pack' };
const EARNED = { id: METER_ID, title: 'The ledger', meter: 'trust', at: 5, text: 'Ana keeps a ledger.', from: 'pack' };
const QUOTE = 'Under the bench they find a spare oar with her mark.';
const LINE = `~ reveal Ana | opened: ${EVENT_ID} | quote: "they find a spare oar with her mark"`;
const ana = (extra = {}) => person('npc_ana', 'Ana', [], { secrets: [TOLD, EARNED], ...extra });
const bo = () => person('npc_bo', 'Bo', ['Red'], { secrets: [{ ...note('Bo'), text: 'Bo is a spy.' }] });
// (her trust, 10, is already past the meter note's 5; she has no entry of her own until a line gives her one)
const scene = async (...records) => {
    const h = await castWith({ settings: { stages: STAGES } }, ...records);
    h.registry.register({ id: 'test-scene', name: 'Scene', queries: { 'scene.present': () => [] } });
    return h;
};

test('"~ reveal" opens a dead person\'s own story note, and only that one; their dossier holds it', async () => {
    const h = await scene(ana(), bo());
    await h.die('npc_ana');
    const [result] = h.reply(QUOTE, LINE).results;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(h.bonds().npc_ana.unlocked, [EVENT_ID]);
    assert.deepEqual(h.bonds().npc_ana.stages, {}, 'no stage moves');
    assert.equal(h.runQuery('people.secretOwners')['the oar']?.id, 'npc_ana', 'their dossier holds the opened note');
    assert.equal(h.runQuery('people.secretOwners')['the ledger'], undefined);
    // The reader's dossier, as the view builds it (ui/select) and as NPC State's own panel does.
    const shown = dossierMap((name, args) => { try { return h.runQuery(name, args); } catch { return null; } }).npc_ana.secrets;
    assert.deepEqual([shown.opened, shown.total], [1, 1], 'the meter note can no longer open, so it is not promised');
    assert.deepEqual(shown.items.map(item => [item.open, item.title]), [[true, 'The oar']]);
    const panel = h.adapter.dossierMeters([h.delta.records.npc_ana]).npc_ana.secrets;
    assert.deepEqual(panel.map(item => [item.state, item.title ?? null]), [['open', 'The oar']]);
});

test('a dead person with nothing opened shows on their dossier as before: no notes', async () => {
    const h = await scene(ana(), bo());
    await h.die('npc_ana');
    assert.equal(dossierMap((name, args) => { try { return h.runQuery(name, args); } catch { return null; } }).npc_ana.secrets.total, 0);
    assert.equal(h.adapter.dossierMeters([h.delta.records.npc_ana]).npc_ana, undefined);
});

test('no meter opens a dead person\'s note: not a refresh, not the per-reply step, and a meter line about them is refused', async () => {
    const h = await scene(ana(), bo());
    h.line('~ npc Bo | trust: +1');
    await h.die('npc_ana');
    h.reply(QUOTE, LINE);
    const before = structuredClone(h.bonds().npc_ana);
    assert.match(h.refused('~ npc Ana | trust: +20').message, /has died/);
    for (const type of ['npc.refresh', 'npc.tick']) {
        const out = h.bus.command(type, { name: 'npc_ana' }, { cause: 'system' });
        assert.ok(out.ok || out.message === 'Nothing to update.', JSON.stringify(out));
        if (out.ok) h.store.append({ ops: out.ops, receipt: out.receipt });
    }
    assert.deepEqual(h.bonds().npc_ana, before);
});

test('a story event opens it too (the scan\'s npc.open), never a meter-gated one beside it', async () => {
    const h = await scene(ana(), bo());
    await h.die('npc_ana');
    const out = await h.adapter.openByEvent({ id: 'npc_ana', name: 'Ana', ids: [EVENT_ID] });
    assert.equal(out?.ok, true, JSON.stringify(out));
    assert.deepEqual(h.bonds().npc_ana.unlocked, [EVENT_ID]);
});

test('nobody else\'s notes are used for the dead: not an alias holder\'s, not a living namesake\'s', async () => {
    const h = await scene(ana({ aliases: ['Red'], secrets: [] }), bo());
    await h.die('npc_ana');
    const [result] = h.reply(QUOTE, LINE).results;
    assert.match(result.message, /not one of their hidden notes/);
    assert.deepEqual(h.bonds().npc_ana?.unlocked ?? [], []);
});

test('a living person\'s meter note still opens by their meter', async () => {
    const h = await scene(ana());
    h.line('~ npc Ana | trust: +1');
    assert.deepEqual(h.bonds().npc_ana.unlocked, [METER_ID]);
});
