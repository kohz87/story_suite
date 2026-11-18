// "Show what's sent" and modules' own prompts in the prompt size (v1-med: V1_AUDIT #4 and #9).
//
// - Story Suite's settings fold has, under the prompt size, a "Show what's sent" sub-fold: the exact text of
//   every part the next reply would get (the static part, this reply's part, and what a module sends on its
//   own), per module, with Copy. It only reads: nothing is sent and nothing is stored.
// - A module that sends text with the reply under its own prompt keys (NPC State Delta's dossiers) says what
//   through its `ownPrompt(view)` hook. turn.previewFit() lists it (`own`), the prompt size shows it as a row
//   of its own and in the total, and it counts toward the share of the context (prompt.js contextFit): the
//   tail gets what the static part and it leave, never below MIN_TAIL_BUDGET. The static part never changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { DEFAULT_CONTEXT_SHARE, MIN_TAIL_BUDGET, contextFit, estimateTokens } from '../../core/prompt.js';
import { createRegistry } from '../../core/registry.js';
import { createSettings } from '../../core/sdk.js';
import { SETTINGS_TEXT } from '../../core/settings-text/text.js';
import { promptSize, sentText } from '../../core/sent/sent.js';

const T = SETTINGS_TEXT.sent;

// A module with a short static part and a long tail (4 required lines, 150 optional ones).
const talker = {
    id: 'zz-talk', name: 'Talker',
    context: {
        static: () => 'Talker rules: keep it short.',
        tail: () => ({
            lines: ['Need 1: the gate is shut.', 'Need 2: the guard sleeps.'],
            optional: Array.from({ length: 150 }, (_, i) => `Maybe ${i + 1}: a detail of the scene that can be left out.`),
        }),
    },
};
// A module that sends its own text (as NPC State Delta does), `size` characters of it.
const sender = (size = 2000, extra = {}) => ({
    id: 'zz-own', name: 'Own Sender',
    hooks: { ownPrompt: () => [{ label: 'Live dossier', text: `Dossier for {{user}}: ${'d'.repeat(size)}` }] },
    ...extra,
});

async function host(t, modules, { contextSize = 8192 } = {}) {
    t.mock.method(console, 'warn', () => {});
    const h = await createHost({ modules, st: { contextSize } });
    t.after(() => h.close());
    return h;
}
const last = (h, key) => h.st.promptLog.filter(entry => entry.key === key && entry.value).at(-1)?.value ?? '';

test('previewFit lists what a module sends on its own, names filled in, counted at four characters a token', async t => {
    const h = await host(t, [talker, sender(400)]);
    const { parts, fit, own } = h.turn.previewFit();
    assert.ok(Array.isArray(parts) && parts.length);
    assert.equal(own.length, 1);
    assert.equal(own[0].module, 'zz-own');
    assert.equal(own[0].label, 'Live dossier');
    assert.equal(own[0].place, 'own');
    assert.doesNotMatch(own[0].text, /\{\{user\}\}/, 'names are filled in as SillyTavern fills them');
    assert.equal(own[0].tokens, estimateTokens(own[0].text));
    assert.ok(!parts.some(part => part.place === 'own'), 'the parts Story Block sends stay its own');
    // No reply yet: no context size known, so no fit.
    assert.equal(fit, null);
    // preview() (parts only) is unchanged.
    assert.deepEqual(h.turn.preview().map(part => part.text), parts.map(part => part.text));
});

test('a module alone (no ownPrompt hook): own is empty, the size has no such row', async t => {
    const h = await host(t, [talker]);
    assert.deepEqual(h.turn.previewFit().own, []);
    const size = promptSize(h.turn.preview(), {});
    assert.deepEqual(size.own, []);
    assert.equal(size.total, size.static + size.tail);
});

test('an ownPrompt hook that throws, answers a promise or nothing counts nothing and holds nothing back', async t => {
    const h = await host(t, [talker, {
        id: 'zz-bad', name: 'Bad',
        hooks: { ownPrompt: () => { throw new Error('broken'); } },
    }, {
        id: 'zz-late', name: 'Late',
        hooks: { ownPrompt: async () => [{ text: 'late text' }] },
    }, {
        id: 'zz-none', name: 'None',
        hooks: { ownPrompt: () => null },
    }, {
        id: 'zz-str', name: 'Plain',
        hooks: { ownPrompt: () => 'plain words' },
    }]);
    const { own } = h.turn.previewFit();
    assert.deepEqual(own.map(part => [part.module, part.label, part.text]), [['zz-str', 'Plain', 'plain words']], 'a string is one part labelled with the module name');
    await h.send('I wait.', 'Rain.');
    assert.ok(last(h, 'story_suite_static').includes('Talker rules'), 'the reply went out');
});

test('a feature that is off: its ownPrompt hook is not asked', async t => {
    let asked = 0;
    const h = await host(t, [talker, {
        id: 'zz-feat', name: 'Feat',
        features: [{ id: 'zz-feat.dossier', label: 'Dossier', default: true }],
        hooks: { ownPrompt: Object.assign(() => { asked += 1; return 'some text'; }, { feature: 'zz-feat.dossier' }) },
    }]);
    assert.equal(h.turn.previewFit().own.length, 1);
    h.features.set('zz-feat.dossier', false);
    const before = asked;
    assert.deepEqual(h.turn.previewFit().own, []);
    assert.equal(asked, before);
});

test('contextFit: a module\'s own prompt takes from the share before the tail, never below the least', () => {
    const plain = contextFit({ room: 10000 }, 1000, {});
    const withOwn = contextFit({ room: 10000 }, 1000, {}, 1500);
    assert.equal(plain.own, 0);
    assert.equal(withOwn.own, 1500);
    assert.equal(plain.budget, 1500, 'share 4,000 − static 1,000 leaves more than the tail budget');
    assert.equal(withOwn.budget, 1500, 'still room for the whole tail budget');
    assert.equal(contextFit({ room: 6000 }, 1000, {}, 900).budget, 2400 - 1000 - 900);
    assert.equal(contextFit({ room: 6000 }, 1000, {}, 5000).budget, MIN_TAIL_BUDGET);
    assert.equal(contextFit({ room: 6000 }, 3000, {}, 0).tooSmall, true, 'the notice is about the instructions alone');
    assert.equal(contextFit({ room: 6000 }, 1000, {}, 5000).tooSmall, false, 'a big own prompt only cuts the tail');
    assert.equal(contextFit({ room: 6000 }, 1000, {}, -5).own, 0);
});

test('a small context: the tail sent is cut so static + tail + the module\'s own text fit the share; static unchanged', async t => {
    const contextSize = 6000;
    const share = Math.floor(contextSize * DEFAULT_CONTEXT_SHARE / 100);
    const alone = await host(t, [talker], { contextSize });
    await alone.send('I wait.', 'Rain.');
    const both = await host(t, [talker, sender(2400)], { contextSize });
    await both.send('I wait.', 'Rain.');
    const own = both.turn.previewFit().own[0].tokens;
    const tailAlone = last(alone, 'story_suite_tail_1');
    const tailBoth = last(both, 'story_suite_tail_1');
    const stat = last(both, 'story_suite_static');
    assert.ok(estimateTokens(tailBoth) < estimateTokens(tailAlone), 'less tail when the module sends its own text');
    assert.ok(estimateTokens(stat) + estimateTokens(tailBoth) + own <= share, `static ${estimateTokens(stat)} + tail ${estimateTokens(tailBoth)} + own ${own} within ${share}`);
    for (const line of ['Need 1', 'Need 2']) assert.match(tailBoth, new RegExp(line), 'required lines kept');
    // The static part is byte-identical with and without it, and reply to reply.
    assert.equal(last(alone, 'story_suite_static'), stat);
    await both.send('Again.', 'Rain again.');
    assert.equal(last(both, 'story_suite_static'), stat);
    // Story Block never sends the module's own text.
    assert.ok(!both.st.promptLog.some(entry => String(entry.value ?? '').includes('Dossier for')));
    assert.equal(both.turn.previewFit().fit.own, own);
});

test('previewing never sends or stores anything', async t => {
    const h = await host(t, [talker, sender(100)]);
    await h.send('I wait.', 'Rain.');
    const log = h.st.promptLog.length;
    const head = JSON.stringify(h.head());
    for (let i = 0; i < 3; i += 1) h.turn.previewFit();
    assert.equal(h.st.promptLog.length, log, 'no extension prompt was set');
    assert.equal(JSON.stringify(h.head()), head, 'the state is as it was');
});

const parts = [
    { module: 'story-suite', label: 'Story Suite: instructions', place: 'static', text: 'HEADER line\nsecond line' },
    { module: 'rpg-battle', label: 'RPG Battle: instructions', place: 'static', text: 'RB rules.' },
    { module: 'story-suite', label: 'Happened', place: 'tail', text: '[Happened]\nA wolf ran off.' },
    { module: 'rpg-battle', label: 'RPG Battle: this reply', place: 'tail', text: 'HP 10/12.', dropped: 2 },
    { module: 'loot', label: 'Loot: this reply', place: 'tail', text: '', dropped: 1 },
];
const own = [{ module: 'npc-state-delta', label: 'Live dossier', place: 'own', text: 'Mira: IDENTITY quiet smith.' }];

test('sentText: each place\'s parts, and Copy\'s text joined as prompt.js joins them', () => {
    const names = id => ({ 'npc-state-delta': 'NPC State Delta' })[id] ?? id;
    const out = sentText(parts, own, { names });
    assert.deepEqual(out.static.map(part => part.title), ['Story Suite: instructions', 'RPG Battle: instructions']);
    assert.deepEqual(out.tail.map(part => [part.title, part.dropped]), [['Happened', 0], ['RPG Battle: this reply', 2], ['Loot: this reply', 1]]);
    assert.deepEqual(out.own.map(part => part.title), ['NPC State Delta: Live dossier']);
    assert.equal(out.copy, [
        `[${T.static}]`, 'HEADER line\nsecond line\n\nRB rules.', '',
        `[${T.tail}]`, '[Happened]\nA wolf ran off.\nHP 10/12.', '',
        '[NPC State Delta: Live dossier]', 'Mira: IDENTITY quiet smith.',
    ].join('\n'));
    assert.equal(sentText([], []).copy, '', 'nothing to copy');
});

test('the prompt size counts a module\'s own prompt in the total, and an older source with no `own` has none', () => {
    const n = estimateTokens(own[0].text);
    const expected = promptSize(parts, { own });
    assert.equal(expected.total, expected.static + expected.tail + n);
    assert.equal(promptSize(parts, {}).total, expected.total - n);
});

test('reading the prompt for the fold sends nothing, and holds the real static header and the module\'s own text', async t => {
    const h = await host(t, [talker, sender(200)]);
    await h.send('I wait.', 'Rain.');
    const log = h.st.promptLog.length;
    const read = h.turn.previewFit();
    const shown = sentText(read.parts, read.own ?? [], { names: id => id });
    const texts = [...shown.static, ...shown.tail, ...shown.own].map(part => part.text);
    assert.ok(texts.some(text => text.startsWith('[Story Suite: how this story is kept]')), 'the real static header');
    assert.ok(texts.some(text => text.startsWith('Dossier for ')), 'the module\'s own text');
    assert.equal(h.st.promptLog.length, log);
});
