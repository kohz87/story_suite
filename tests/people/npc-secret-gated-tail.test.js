import test from 'node:test';
import assert from 'node:assert/strict';
import { host, fakeDelta } from './storysuite-v2-meters.helpers.js';
import { applyCastEntry } from '../../modules/people/dossier/cast-dossier.js';
import { normalizeEntry } from '../../modules/people/dossier/cast-dossier-parts/entry-normalize.js';
import { closedSecrets } from '../../modules/world/chronicle/world-daily/arc-brief.js';
import { learnedAnchors } from '../../modules/world/chronicle/world-daily/learned.js';

// A pack's spec secret in NPC State's prompt tail (world-events switch): closed = nothing; gate open = "(may come out)"; learned = the known line.
const ON = { 'story-director.world-events': true };
const TEXT = 'The prior forged the last rite.';
const OLD = 'She is the lost heir of House Venn.';
const delta = () => {
    const d = fakeDelta();
    d.records.npc_mira.secrets = [{ packId: 'rite', gate: 'fact:vault-opened', text: TEXT, from: 'pack' }, { text: OLD, meter: 'trust', at: 30 }];
    return d;
};
const lines = h => { const out = h.def.context.tail(h.view()); return [...out.lines.filter(line => typeof line === 'string'), ...out.optional]; };
const has = (h, text) => lines(h).some(line => line.includes(text));

test('switch on: a closed gate sends nothing; the gate open sends "(may come out)" once; an old-shape note keeps "(hidden)"', async () => {
    const answers = { 'chronicle.world.anchors': [] };
    const h = await host({ delta: delta(), features: ON, answers });
    h.reply('Nice.', '~ npc Mira | trust: +1');
    assert.equal(has(h, TEXT), false, 'closed: the text is nowhere in the tail');
    assert.equal(has(h, OLD), true, 'an old-shape note is as before');
    assert.ok(lines(h).some(line => line.includes(`Mira (hidden): ${OLD}`)));
    answers['chronicle.world.anchors'] = ['fact:vault-opened'];
    const ready = lines(h).filter(line => line.includes(TEXT));
    assert.equal(ready.length, 1);
    assert.equal(ready[0], `Lines marked (may come out) are secrets the story has now earned: you may let one come out in this reply, once, only if it fits the scene; never force it.\nMira (may come out): ${TEXT}`);
    assert.equal(h.def.hooks.redactSent(ready[0]).includes(TEXT), false, 'What\'s sent hides it');
});

test('switch off or a host without the switch: nothing of the gated note, and the old note is as before', async () => {
    const answers = { 'chronicle.world.anchors': ['fact:vault-opened'] };
    for (const features of [{}, null]) {
        const off = await host({ delta: delta(), ...(features ? { features } : {}), answers });
        off.reply('Nice.', '~ npc Mira | trust: +1');
        assert.equal(has(off, TEXT), false, 'switch off: the gated note is not read');
        assert.equal(has(off, OLD), true);
    }
});

test('seeding: spec secrets reach a dossier only with the switch on; the old fields are as before', () => {
    const entry = normalizeEntry({ id: 'temiwa', name: 'Temiwa', kind: 'companion', secrets: [{ id: 'page', gate: 'meter trust >= 40', text: TEXT, writes_fact: 'proof' }, { title: 'Old', text: OLD, meter: 'trust', at: 30 }] });
    const person = { key: 'p:temiwa', pack: 'p', id: 'temiwa', entry, met: {} };
    const base = { id: 'npc_t', name: 'Temiwa', relationship: {} };
    assert.deepEqual(applyCastEntry(base, person).secrets.map(note => note.text), [OLD], 'off: as before (the spec secret is dropped)');
    const on = applyCastEntry(base, person, { gated: true }).secrets;
    assert.deepEqual(on.map(note => [note.packId ?? null, note.gate ?? null, note.from]), [[null, null, 'pack'], ['page', 'meter trust >= 40', 'pack']]);
});

test('learned: a gated note opened in NPC State is recorded by its pack id; the Director sees the unlearned ones only', () => {
    const cast = [{ kind: 'companion', id: 'temiwa', name: 'Temiwa', secrets: [{ id: 'page', gate: 'meter trust >= 40', text: TEXT, writes_fact: 'proof' }] }];
    const people = unlocked => ({ npcs: { npc_t: { name: 'Temiwa', castFrom: { id: 'temiwa' }, secrets: [{ id: 'sec_zzzzzzzz', packId: 'page', gate: 'meter trust >= 40', text: `${TEXT} (clipped differently)`, from: 'pack' }] } }, order: ['npc_t'], bonds: { npcs: { npc_t: { unlocked } } } });
    assert.deepEqual(learnedAnchors(people(['sec_zzzzzzzz']), cast), ['learned:temiwa/page', 'fact:proof']);
    assert.deepEqual(learnedAnchors(people([]), cast), []);
    assert.deepEqual(closedSecrets(people([])), [{ name: 'Temiwa', text: `${TEXT} (clipped differently)` }]);
    assert.deepEqual(closedSecrets(people(['sec_zzzzzzzz'])), [], 'learned: no longer in the never-hint block');
});

test('the Director\'s block: unlearned pack secrets under the never-hint rule; none, no block', async () => {
    const { worldBriefText } = await import('../../modules/arc/plan/prompt-parts/world-brief.js');
    const text = worldBriefText({ threads: [], secrets: [{ name: 'Temiwa', text: TEXT }] });
    assert.match(text, /Secrets not yet learned \(never surface or hint at them in a beat, clock or agenda; they come out only when the story earns it\):\n- Temiwa: The prior forged the last rite\./);
    assert.equal(worldBriefText({ threads: [] }).includes('Secrets not yet learned'), false);
});
