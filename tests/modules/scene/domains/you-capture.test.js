// Your look (MODULES §F126, src/v2/domains/scene.js): parsing, validation, capture and feature/tail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { YOU_CHARS, YOU_FEATURE, captureYou, initialScene, sceneTail, validateScene, youNote, youParts, youText } from '../../../../modules/scene/index.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { NONE, block, fresh, lastIndex, look, staticText, tailText } from './you.helpers.js';

// ---------------------------------------------------------------------------------------------------
// Reading one line

test('a part of the look is one plain line: markup, markdown and invisible characters out, cut at 120 code points; no words is empty', () => {
    assert.equal(YOU_CHARS, 120);
    assert.equal(youText('oilskin coat, boots'), 'oilskin coat, boots');
    assert.equal(youText('**grey** <b>wool</b>​ tunic, <img src=x onerror=alert(1)>boots‮ and a belt'), 'grey wool tunic, boots and a belt');
    assert.equal(youText('a < b > c'), 'a c');
    const long = youText('𐐷'.repeat(300));
    assert.equal(Array.from(long).length, YOU_CHARS);
    assert.ok(long.endsWith('…'));
    assert.ok(Array.from(long).slice(0, -1).every(point => point === '𐐷'), 'no character split in half');
    assert.equal(youText('x'.repeat(120)), 'x'.repeat(120), 'exactly the cap is kept whole');
    for (const empty of ['', '   ', '...', '—', '<i></i>', undefined, null]) assert.equal(youText(empty), '', `${String(empty)}: no words`);
    assert.deepEqual(youParts('~ you wearing: oilskin coat, boots | condition: tired and cold'), { wearing: 'oilskin coat, boots', condition: 'tired and cold' });
    assert.deepEqual(youParts('~ you rank: F-rank, Adventurer Guild (provisional) | wearing: a coat | condition: tired'), { rank: 'F-rank, Adventurer Guild (provisional)', wearing: 'a coat', condition: 'tired' });
    assert.deepEqual(youParts('~ you Standing: novice'), { rank: 'novice' });
    assert.deepEqual(youParts('~ you condition: tired'), { condition: 'tired' });
    assert.deepEqual(youParts('+ you **Wearing**: a grey coat'), { wearing: 'a grey coat' });
    assert.deepEqual(youParts('~ you rank: | wearing: | condition: '), { rank: '', wearing: '', condition: '' }, 'empty parts clear');
    assert.deepEqual(youParts('~ you worn: a hat | state: dizzy | mood: glad'), { wearing: 'a hat', condition: 'dizzy' }, 'a few other words for the parts; an unknown label is not used');
    assert.deepEqual(youParts('~ you wearing: a coat | boots | condition: cold'), { wearing: 'a coat, boots', condition: 'cold' }, 'a part with no label goes on the one before');
    assert.deepEqual(youParts('~ you hat: x'), {});
    assert.deepEqual(youParts('~ you'), {});
    assert.deepEqual(youParts(undefined), {});
});

test('the validator: no look is fine (an older chat); a look is a record of texts of at most 120 code points, each part optional', () => {
    assert.deepEqual(initialScene(), { place: { name: '', kind: '', region: '' }, present: [] }, 'absent until a reply writes one: older chats read as empty');
    const ok = initialScene();
    assert.deepEqual(validateScene(ok), []);
    for (const you of [NONE, { wearing: 'a coat' }, { condition: 'tired' }, { rank: 'F-rank' }, {}, { rank: 'r'.repeat(120), wearing: '𐐷'.repeat(120), condition: 'x'.repeat(120) }]) assert.deepEqual(validateScene({ ...ok, you }), [], JSON.stringify(you).slice(0, 40));
    assert.match(validateScene({ ...ok, you: 'coat' }).join(' '), /Your look is not a record/);
    assert.match(validateScene({ ...ok, you: [] }).join(' '), /not a record/);
    assert.match(validateScene({ ...ok, you: { wearing: 4 } }).join(' '), /Your wearing is not text/);
    assert.match(validateScene({ ...ok, you: { rank: 4 } }).join(' '), /Your rank is not text/);
    assert.match(validateScene({ ...ok, you: { rank: 'x'.repeat(121) } }).join(' '), /Your rank is longer than 120/);
    assert.match(validateScene({ ...ok, you: { condition: 'x'.repeat(121) } }).join(' '), /Your condition is longer than 120/);
});

// ---------------------------------------------------------------------------------------------------
// Capture on the real host

test('~ you keeps the parts in the scene; scene.you answers { wearing, condition }; either part alone; an empty one clears; no receipt is told', async t => {
    const host = await fresh(t);
    assert.deepEqual(look(host), NONE, 'empty until a reply writes one');
    assert.equal(host.head().domains.scene.you, undefined);
    await host.send('We walk.', block('Rain sets in.', ['~ you rank: F-rank, Adventurer Guild | wearing: oilskin coat, river-soaked boots | condition: tired, <b>cold</b>']));
    const receipt = host.store.receipts().at(-1)?.receipt ?? host.store.receipts().at(-1);
    assert.deepEqual(look(host), { rank: 'F-rank, Adventurer Guild', wearing: 'oilskin coat, river-soaked boots', condition: 'tired, cold' });
    assert.deepEqual(host.head().domains.scene.you, { rank: 'F-rank, Adventurer Guild', wearing: 'oilskin coat, river-soaked boots', condition: 'tired, cold' });
    assert.equal(receipt.narrate, false, 'never re-narrated');
    assert.deepEqual(host.turn.problems().filter(item => item.index === lastIndex(host)), []);
    // One part alone: the other stays.
    await host.send('On.', block('The coat dries.', ['~ you condition: warm again']));
    assert.deepEqual(look(host), { rank: 'F-rank, Adventurer Guild', wearing: 'oilskin coat, river-soaked boots', condition: 'warm again' });
    await host.send('On.', block('A new cloak.', ['+ you wearing: a borrowed cloak']));
    assert.deepEqual(look(host), { rank: 'F-rank, Adventurer Guild', wearing: 'a borrowed cloak', condition: 'warm again' });
    await host.send('On.', block('Promoted.', ['~ you rank: E-rank']));
    assert.deepEqual(look(host), { rank: 'E-rank', wearing: 'a borrowed cloak', condition: 'warm again' });
    // The same again changes nothing.
    const was = structuredClone(host.head().domains.scene.you);
    await host.send('On.', block('Same.', ['~ you rank: E-rank | wearing: a borrowed cloak | condition: warm again']));
    assert.deepEqual(host.head().domains.scene.you, was);
    // An empty value clears its part only.
    await host.send('On.', block('Bare.', ['~ you wearing:']));
    assert.deepEqual(look(host), { rank: 'E-rank', wearing: '', condition: 'warm again' });
    await host.send('On.', block('Fine.', ['~ you condition: ', '~ you wearing: a shirt']));
    assert.deepEqual(look(host), { rank: 'E-rank', wearing: 'a shirt', condition: '' });
    await host.send('On.', block('Unranked.', ['~ you rank:']));
    assert.deepEqual(look(host), { rank: '', wearing: 'a shirt', condition: '' });
    // The place, the weather and the people are not touched; the line is hidden like any change line.
    assert.equal(host.sdk.query('scene.place').name, 'Vell Harbour');
    assert.doesNotMatch(host.ctx.chat[lastIndex(host)].mes.replace(/<!--[\s\S]*?-->/g, ''), /\byou\b.*wearing/);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
});

test('over-long text is cut at 120 code points, not refused', async t => {
    const host = await fresh(t);
    await host.send('We walk.', block('Rain.', [`~ you rank: ${'r'.repeat(300)} | wearing: ${'a long coat with many buttons, '.repeat(10)} | condition: ${'𐐷'.repeat(200)}`]));
    const { rank, wearing, condition } = look(host);
    assert.equal(Array.from(rank).length, YOU_CHARS);
    assert.equal(Array.from(wearing).length, YOU_CHARS);
    assert.ok(wearing.endsWith('…'));
    assert.equal(Array.from(condition).length, YOU_CHARS);
    assert.deepEqual(host.turn.problems().filter(item => item.index === lastIndex(host)), [], 'cut, not a Problem');
});

test('refused: a wrong op or no part named; nothing is saved', async t => {
    const host = await fresh(t);
    await host.send('We walk.', block('Rain.', ['~ you wearing: a coat']));
    const before = JSON.stringify(host.head().domains.scene);
    await host.send('On.', block('Nothing.', ['- you wearing: a coat', '~ you hat: red', '~ you']));
    const told = host.turn.problems().filter(item => item.index === lastIndex(host));
    assert.deepEqual(told.map(item => item.code).sort(), ['INVALID', 'INVALID', 'UNREADABLE'], 'a bare "~ you" is not a change line at all');
    const said = line => told.find(item => item.line === line)?.message;
    assert.match(said('- you wearing: a coat'), /use ~ you rank/);
    assert.match(said('~ you hat: red'), /no part of your look/);
    assert.equal(JSON.stringify(host.head().domains.scene), before);
    // captureYou on its own, with a line that carries no raw text (a module's call): the parsed fields are read.
    assert.throws(() => captureYou({ fail: (code, message) => { throw new Error(`${code}: ${message}`); }, draft: () => ({}) }, { op: '!', name: 'wearing: x' }), /INVALID: "!" you|INVALID: "! you"/);
});

// ---------------------------------------------------------------------------------------------------
// The feature

test('the feature: on by default with its grammar line in a byte-identical static part; off: no line, a quiet Problem, null, nothing captured', async t => {
    const host = await fresh(t);
    assert.equal(host.features.on(YOU_FEATURE), true);
    assert.equal(YOU_FEATURE, CORE_FEATURE.you);
    assert.equal(host.features.list().find(feature => feature.id === YOU_FEATURE).label, 'Your look');
    const on = staticText(host);
    const line = on.split('\n').find(item => item.startsWith('~ you '));
    assert.match(line, /^~ you rank: Guild rank \| wearing: what You has on \| condition: how You is \(only when one changes; each at most 120 characters\)$/, '{{user}} is the persona\'s name');
    await host.send('We walk.', block('Rain.', ['~ you wearing: a coat']));
    await host.send('On.', block('Fog.', ['~ you condition: damp']));
    assert.equal(staticText(host), on, 'the same bytes reply to reply, whatever the look');
    host.features.set(YOU_FEATURE, false);
    await host.send('On.', block('Snow.', ['~ you wearing: a hat | rank: Z']));
    const off = staticText(host);
    assert.notEqual(off, on, 'changed once');
    assert.doesNotMatch(off, /~ you /);
    const told = host.turn.problems().filter(item => item.index === lastIndex(host));
    assert.deepEqual(told.map(item => [item.code, item.quiet]), [['FEATURE_OFF', true]]);
    assert.equal(host.sdk.query('scene.you'), null, 'the query is off with it');
    assert.deepEqual(host.head().domains.scene.you, { rank: '', wearing: 'a coat', condition: 'damp' }, 'the line written while off changed nothing');
    assert.equal(look(host), null);
    assert.equal((await host.sdk.command('scene.you', { wearing: 'x' })).ok, false, 'the command is off with it');
    await host.send('On.', 'More snow.');
    assert.equal(staticText(host), off);
    assert.doesNotMatch(tailText(host), /wears|condition/, 'no tail line while off');
    host.features.set(YOU_FEATURE, true);
    await host.send('On.', 'Thaw.');
    assert.equal(staticText(host), on, 'back on: the old bytes');
    assert.deepEqual(look(host), { rank: '', wearing: 'a coat', condition: 'damp' });
});

test('the tail: one line for the narrator, rank first, only the parts that are set, only while the feature is on', async t => {
    const host = await fresh(t);
    await host.send('We walk.', 'We walk on.');
    assert.doesNotMatch(tailText(host), /^You:|wears/m, 'nothing set: no look line (the tail asks for one instead, you-first.test.js)');
    await host.send('On.', block('Rain.', ['~ you rank: F-rank | wearing: oilskin coat | condition: tired']));
    await host.send('On.', 'On.');
    assert.match(tailText(host), /^You: Guild rank F-rank; wears oilskin coat; condition tired$/m, '{{user}} becomes the persona\'s name');
    await host.send('On.', block('Bare.', ['~ you wearing:']));
    await host.send('On.', 'On.');
    assert.match(tailText(host), /^You: Guild rank F-rank; condition tired$/m);
    await host.send('On.', block('Bare.', ['~ you rank: | wearing: a shirt | condition:']));
    await host.send('On.', 'On.');
    assert.match(tailText(host), /^You: wears a shirt$/m);
    host.features.set(YOU_FEATURE, false);
    await host.send('On.', 'On.');
    assert.doesNotMatch(tailText(host), /wears/);
    // As pure data: with `you` on, after the Place and Present lines; empty parts left out; off by default of the function.
    const state = { domains: { scene: { ...initialScene(), place: { name: 'Vell Harbour', kind: '', region: '' }, present: ['Ren'], you: { rank: '', wearing: 'a coat', condition: '' } } } };
    assert.deepEqual(sceneTail(state, { you: true }), ['Place: Vell Harbour', 'Present: Ren', '{{user}}: wears a coat', youNote({ wearing: 'a coat' })]);
    assert.deepEqual(sceneTail({ domains: { scene: { ...state.domains.scene, you: { rank: 'F', wearing: 'a coat', condition: '' } } } }, { you: true }), ['Place: Vell Harbour', 'Present: Ren', '{{user}}: wears a coat', youNote({ wearing: 'a coat' })], 'a rank with no pack that gives one is not told');
    assert.deepEqual(sceneTail(state), ['Place: Vell Harbour', 'Present: Ren']);
    assert.deepEqual(sceneTail({ domains: { scene: { ...initialScene(), you: NONE } } }, { you: true }), [youNote(NONE)]);
    assert.deepEqual(sceneTail({ domains: { scene: { ...initialScene(), you: { condition: 'hurt', rank: 'F' } } } }, { you: true, rankLabel: 'Guild rank' }), ['{{user}}: Guild rank F; condition hurt', youNote({ condition: 'hurt' })]);
});
