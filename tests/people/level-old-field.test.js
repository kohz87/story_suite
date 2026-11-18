// Pack format 4, F5: a chat from before the built-in Level kept it as the custom field "Level". While `level` is absent, a whole number there is the
// Level (normalizeNpcRecord, the line reader and the store's writer read it the same way), so "only up" carries over; the custom field stays as it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { normalizeNpcRecord } from '../../modules/people/core/core.js';
import { storedLevel } from '../../modules/people/core/core-record-parts/stored-level.js';
import { levelField } from '../../modules/people/meters/npc-lines-parts/level.js';

const oldChat = fields => ({ ...dossiers(), npc_oren: { ...dossiers().npc_oren, customFields: fields } });
const dossier = s => s.host.head().domains.people.npcs.npc_oren;
const problems = s => JSON.stringify(s.host.head().domains.people.bonds.problems);
const snap = s => JSON.stringify(s.host.head().domains.people);

test('normalizeNpcRecord: a whole-number custom Level (any case) is the Level while level is absent; other values and a stored level are not', () => {
    const npc = fields => normalizeNpcRecord({ id: 'npc_a', name: 'A', ...fields });
    assert.equal(npc({ customFields: { Level: '7' } }).level, 7);
    assert.equal(npc({ customFields: { LEVEL: '12', Class: 'Rogue' } }).level, 12, 'any case');
    assert.deepEqual(npc({ customFields: { level: '7' } }).customFields, { level: '7' }, 'the custom field stays');
    for (const value of ['C-D', 'high', '0', '100', '2.5', 'Lv 5']) assert.equal(npc({ customFields: { Level: value } }).level, undefined, value);
    assert.equal(npc({ level: 9, customFields: { Level: '20' } }).level, 9, 'a stored level wins');
    assert.equal(npc({ customFields: { Class: 'Rogue' } }).level, undefined);
    assert.equal(storedLevel({ level: 'x', customFields: { Level: '5' } }), null, 'only an absent level reads the custom field');
});

test('the line reader: a line lower than or equal to the old custom Level never lowers it', () => {
    assert.deepEqual(levelField({ level: '5' }, { customFields: { Level: '7' } }), { set: {}, problems: ['level is already 7; a line never lowers it.'] });
    assert.deepEqual(levelField({ level: '8' }, { customFields: { level: '7' } }), { set: { level: '8' }, problems: [] });
    assert.deepEqual(levelField({ level: '5' }, { customFields: { Level: 'C-D' } }), { set: { level: '5' }, problems: [] });
});

test('on a host: an old chat\'s custom Level holds against a lower line, a higher one raises it, and a rebuild agrees', async () => {
    const s = await suite({ lines: true, levelOn: true, records: oldChat({ Level: '7', Class: 'Rogue' }) });
    await s.say(['~ npc Oren | level: 5']);
    assert.equal(dossier(s).level, undefined, 'not lowered from the old 7');
    assert.match(problems(s), /already 7/);
    await s.say(['~ npc Oren | level: 9']);
    assert.equal(dossier(s).level, 9);
    assert.deepEqual(dossier(s).customFields, { Level: '7', Class: 'Rogue' }, 'the custom field is left as it was');
    const live = snap(s);
    s.host.store.rebuild();
    assert.equal(snap(s), live, 'replay == live');
});

test('the store\'s writer (a module\'s write-back): an old chat\'s custom Level holds against a lower Level; a rebuild agrees', async t => {
    t.mock.method(console, 'warn', () => {});
    const { createHost } = await import('../../testkit/index.js');
    const sheet = { id: 'sheet', name: 'Sheet', commands: { 'sheet.back': (ctx, p) => { ctx.call('people.fields', p); return { summary: 'written back' }; } } };
    const host = await createHost({ modules: [sheet] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    const source = host.store.sourceAt(host.store.headIndex());
    const view = { v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann', customFields: { Level: '7' } } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view })).ok, true);
    const ann = () => host.head().domains.people.npcs.npc_ann;
    await host.sdk.command('sheet.back', { id: 'npc_ann', fields: { level: '5' } });
    assert.equal(ann().level, undefined, 'not lowered from the old 7');
    await host.sdk.command('sheet.back', { id: 'npc_ann', fields: { level: '8' } });
    assert.equal(ann().level, 8);
    const live = JSON.stringify(host.head().domains.people);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains.people), live, 'a rebuild equals live');
});
