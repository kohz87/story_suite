import test from 'node:test';
import assert from 'node:assert/strict';
import { host, fakeDelta } from './storysuite-v2-meters.helpers.js';

// A pack's next closed secret in NPC State's prompt tail (world-events switch): "(not yet told, id)", so the narrator never invents another past.
// One a person and three in all (people in key order); the wording and the `~ reveal` line form are said once; What's sent hides every such line.
const ON = { 'story-director.world-events': true };
const NOT_TOLD = 'Lines marked (not yet told) are a person\'s real past: never contradict them or invent another. Keep it back unless the story truly earns it (a confession, deep trust shown in the scene); then it may come out, once, with its ~ reveal line.';
const FORM = 'A secret that comes out is written: ~ reveal Name | opened: <id> | quote: "short exact quote from this reply".';
const READY = 'Lines marked (may come out) are secrets the story has now earned: you may let one come out in this reply, once, only if it fits the scene; never force it.';
const OLD = 'She is the lost heir of House Venn.';
const gated = (name, letters) => letters.map(letter => ({ packId: `${name}-${letter}`, gate: `fact:${letter}`, text: `${name} secret ${letter.toUpperCase()}.`, from: 'pack' }));
const delta = () => {
    const d = fakeDelta();
    d.records.npc_mira.secrets = [...gated('Mira', ['a', 'b', 'c']), { text: OLD, meter: 'trust', at: 30 }];
    for (const [id, name] of [['npc_oren', 'Oren'], ['npc_zed', 'Zed'], ['npc_zoe', 'Zoe']]) {
        d.records[id] = { id, name, aliases: [], present: true, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 }, secrets: gated(name, ['x', 'y']) };
    }
    return d;
};
const MOVE = ['Mira', 'Oren', 'Zed', 'Zoe'].map(name => `~ npc ${name} | trust: +1`).join('\n');
const all = h => { const out = h.def.context.tail(h.view()); return [...out.lines.filter(line => typeof line === 'string'), ...out.optional]; };
const secretLines = h => all(h).filter(line => /\((?:not yet told|may come out), /.test(line));

test('the first locked secret of each person only; one a person, three in all; the wording and the line form once', async () => {
    const h = await host({ delta: delta(), features: ON, answers: { 'chronicle.world.anchors': [] } });
    h.reply('Nice.', MOVE);
    assert.deepEqual(secretLines(h), [
        `${NOT_TOLD}\n${FORM}\nMira (not yet told, Mira-a): Mira secret A.`,
        'Oren (not yet told, Oren-x): Oren secret X.',
        'Zed (not yet told, Zed-x): Zed secret X.',
    ], 'Zoe, fourth in key order, gets none; no deeper secret is sent');
    const text = all(h).join('\n');
    assert.equal(/secret [BCY]\./.test(text), false);
    assert.ok(text.indexOf('(not yet told, Zed-x)') < text.indexOf(`Mira (hidden): ${OLD}`), 'before the hidden notes: the budget drops those first');
});

test('an open one and the next closed one: both with their ids, the form line said once, before the first of them; redacted', async () => {
    const h = await host({ delta: delta(), features: ON, answers: { 'chronicle.world.anchors': ['fact:a'] } });
    h.reply('Nice.', '~ npc Mira | trust: +1');
    const mira = secretLines(h).filter(line => line.includes('Mira '));
    assert.deepEqual(mira, [`${NOT_TOLD}\n${FORM}\nMira (not yet told, Mira-b): Mira secret B.`, `${READY}\nMira (may come out, Mira-a): Mira secret A.`]);
    const text = all(h).join('\n');
    assert.equal(text.split(FORM).length, 2, 'once');
    assert.equal(text.split(NOT_TOLD).length, 2, 'once');
    const shown = h.def.hooks.redactSent(text);
    assert.equal(/secret [A-Z]\./.test(shown), false);
    assert.equal(shown.includes(OLD), false);
    assert.equal(shown.split('Mira: 1 hidden note').length, 4, 'not yet told, hidden and may come out');
    assert.ok(shown.includes(NOT_TOLD) && shown.includes(FORM) && shown.includes(READY), 'the wordings stay');
});

test('a pack id with brackets is still redacted; switch off: no such line', async () => {
    const d = delta();
    d.records.npc_mira.secrets = [{ packId: 'rite (old)', gate: 'fact:a', text: 'Bracket secret.', from: 'pack' }];
    for (const anchors of [[], ['fact:a']]) {
        const h = await host({ delta: d, features: ON, answers: { 'chronicle.world.anchors': anchors } });
        h.reply('Nice.', '~ npc Mira | trust: +1');
        assert.equal(h.def.hooks.redactSent(all(h).join('\n')).includes('Bracket secret.'), false);
    }
    const off = await host({ delta: delta(), features: {}, answers: { 'chronicle.world.anchors': [] } });
    off.reply('Nice.', MOVE);
    assert.deepEqual(secretLines(off), []);
});

test('the closest person (trust + affection) gets the one REQUIRED not-yet-told line; the others stay optional', async () => {
    const h = await host({ delta: delta(), features: ON, answers: { 'chronicle.world.anchors': [] } });
    h.reply('Nice.', ['~ npc Mira | trust: +1', '~ npc Oren | trust: +1', '~ npc Zed | trust: +8', '~ npc Zed | affection: +8'].join('\n'));
    const out = h.def.context.tail(h.view());
    const required = out.lines.filter(line => typeof line === 'string' && line.includes('(not yet told, '));
    assert.deepEqual(required, [`${NOT_TOLD}\n${FORM}\nZed (not yet told, Zed-x): Zed secret X.`], 'Zed (8 + 8) is closer than Mira (11 + 0): his line is required and carries the wording');
    assert.deepEqual(out.optional.filter(line => line.includes('(not yet told, ')), ['Mira (not yet told, Mira-a): Mira secret A.', 'Oren (not yet told, Oren-x): Oren secret X.']);
});

test('the required not-yet-told line survives a full prompt: a partner with three long opened notes keeps it; the oldest opened note goes first', async () => {
    const { assemble } = await import('../../core/prompt-parts/assemble.js');
    const long = (s, n) => (s + ' ' + 'word '.repeat(80)).slice(0, n);
    const d = fakeDelta(); d.records = {};
    d.records.npc_mira = { id: 'npc_mira', name: 'Mira', aliases: [], present: true, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 },
        secrets: [...[0, 1, 2].map(i => ({ text: long(`MiraOPENED${i}`, 230), meter: 'trust', at: 1 })), { packId: 'Mira-next', gate: 'fact:x', text: long('MiraNOTTOLD', 200), from: 'pack' }] };
    const h = await host({ delta: d, features: ON, answers: { 'chronicle.world.anchors': [] } });
    h.reply('Nice.', '~ npc Mira | trust: +2');
    const out = h.def.context.tail(h.view());
    const reg = { contexts: () => [{ moduleId: 'npc', name: 'NPC State', kinds: [], domains: ['people'], budget: h.def.context.budget, tail: () => out }], statics: () => [], staticParts: () => [], modules: () => [] };
    const text = assemble({ registry: reg, view: {} }).tailText;
    assert.ok(text.includes('Mira (not yet told, Mira-next)'), 'the next secret is told');
    assert.ok(text.includes(NOT_TOLD) && text.includes(FORM), 'with both once-said sentences');
    assert.ok((text.match(/MiraOPENED\d/g) ?? []).length < 3, 'an opened note gave way instead');
});
