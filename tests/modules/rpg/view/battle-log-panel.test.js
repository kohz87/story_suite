import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDom } from '../../../../../../tests/ui/view/mounts/helpers.js';
import { buildPanel, headerText, outcomeOf, panelModel, readResolve, resolveOf, rollText } from '../../../../src/v2/lean-rpg/view/battle-log.js';
import { RESOLVE } from '../../../../src/v2/lean-rpg/index.js';
import { roleOf } from './helpers.js';
import { after, before, foe, panel, pc, result, state } from './battle-log.helpers.js';

test('the adapter reads A\'s record: the acting side\'s total first, who acts on whom, the roll behind each line', () => {
    const read = readResolve(result());
    assert.equal(read.rounds.length, 1);
    assert.deepEqual(read.rounds[0].lines.map(line => [line.who, line.target, line.outcome, line.total, line.vs, line.foe]),
        [['Sluice Rat A', 'Wessel', 'fail', 15, 12, true], ['Wessel', 'Sluice Rat A', 'success', 26, 16, false], ['Ren', 'Sluice Rat B', 'cost', 17, 18, false]]);
    assert.equal(read.rounds[0].lines[1].breakdown, 'd20 14 + STR 7 + Class II 4 + Adept 1 = 26 vs d20 9 + 5 + Class I 2 = 16');
    assert.equal(read.rounds[0].lines[2].breakdown, 'd20 10 + INT 5 + Class II 4 − Edge 2 = 17 vs d20 9 + 5 + Class I 2 = 18 · cornered');
    assert.deepEqual(read.order, ['Sluice Rat A', 'Wessel', 'Ren'], 'the order of the first round');
    assert.equal(readResolve(null), null);
    assert.equal(readResolve({ rounds: [{ n: 1, lines: [{ kind: 'act', outcome: 'success' }] }] }), null, 'a line without its roll is left out');
    assert.equal(readResolve({ rounds: [], checks: [] }), null);
    const checked = readResolve({ checks: [{ kind: 'check', outcome: 'fail', skill: 'Stealth', difficulty: 'hard', dc: 20, pc: pc('Ren', 'dex', { total: 8 }) }], rounds: [], refused: [{ who: 'Ren', text: 'Ren is Down.' }] });
    assert.deepEqual([checked.checks[0].who, checked.checks[0].what, checked.checks[0].total, checked.checks[0].vs, checked.checks[0].outcome], ['Ren', 'Stealth', 8, 20, 'fail']);
    assert.match(checked.checks[0].breakdown, /vs DC 20$/);
    assert.deepEqual(checked.refused, [{ who: 'Ren', why: 'Ren is Down.' }]);
    assert.deepEqual(['success', 'cost', 'fail', 'SUCCESS', 'maybe', undefined].map(outcomeOf), ['success', 'cost', 'fail', '', '', '']);
});

test('the breakdown text: the d20 and each term, then the other side', () => {
    assert.equal(rollText({ d20: 14, parts: [{ label: 'STR', value: 7 }, { label: 'Edge', value: -2 }], total: 19 }), 'd20 14 + STR 7 − Edge 2 = 19');
    assert.equal(rollText({ total: 5 }), '');
    assert.equal(rollText(null), '');
});

test('THEN-FIX 3: a Mana or Stamina arrow names its bar and sits on the first line whose recorded cost moved that bar; a record with no cost keeps the last line the actor took', () => {
    const cost = (who, bar) => ({ id: `c:${who}:${bar}`, kind: 'char', name: who, blocks: 1, from: 3, to: 2, size: 5 });
    const act = (who, stat, extra = {}) => ({ kind: 'act', outcome: 'fail', skill: 'Spark', pc: pc(who, stat), foe: foe('Sluice Rat B', { slot: 2 }), ...extra });
    const costed = { ...result(), rounds: [
        { n: 1, decisive: false, lines: [act('Ren', 'int', { cost: cost('ren', 'stamina') }), act('Wessel', 'str', { skill: null })] },
        { n: 2, decisive: false, lines: [act('Ren', 'int', { cost: cost('ren', 'stamina') }), act('Ren', 'int', { skill: null })] },
    ] };
    const arrows = record => panelModel({ resolve: readResolve(record), state: after, before, roleOf }).rounds.flatMap(round => round.lines).map(line => line.arrows.filter(text => /Stamina|Mana/.test(text)));
    assert.deepEqual(arrows(costed), [['Ren Stamina Tired'], [], [], []], 'the first line that paid the Stamina');
    const bare = { ...costed, rounds: costed.rounds.map(round => ({ ...round, lines: round.lines.map(({ cost: _, ...line }) => line) })) };
    assert.deepEqual(arrows(bare), [[], [], [], ['Ren Stamina Tired']], 'no recorded cost: the last line Ren took, now naming the bar');
    const mana = panelModel({ resolve: readResolve(costed), state: state({ wessel: { mana: 0 }, ren: { stamina: 2 } }), before: state({ wessel: { mana: 3 }, ren: { stamina: 2 } }), roleOf });
    assert.deepEqual(mana.rounds[0].lines.map(line => line.arrows)[1], ['Wessel Mana Empty'], 'a Mana change names Mana');
});

test('THEN-FIX: a defender\'s skill cost on a foe line puts its arrow on that foe line (the line\'s target is the character)', () => {
    const cost = { id: 'c:ren:stamina', kind: 'char', name: 'Ren', blocks: 1, from: 3, to: 2, size: 5 };
    const record = { ...result(), rounds: [{ n: 1, decisive: false, lines: [
        { kind: 'act', outcome: 'fail', skill: null, pc: pc('Ren', 'int'), foe: foe('Sluice Rat B', { slot: 2 }) },
        { kind: 'foe', outcome: 'success', skill: 'Dodge', cost, pc: pc('Ren', 'agi'), foe: foe('Sluice Rat B', { slot: 2 }) },
        { kind: 'act', outcome: 'fail', skill: null, pc: pc('Ren', 'int'), foe: foe('Sluice Rat B', { slot: 2 }) },
    ] }] };
    const arrows = panelModel({ resolve: readResolve(record), state: after, before, roleOf }).rounds[0].lines.map(line => line.arrows.filter(text => /Stamina/.test(text)));
    assert.deepEqual(arrows, [[], ['Ren Stamina Tired'], []]);
});

test('resolveOf takes the rpg.resolve receipt the replay kept, not one it skipped', () => {
    const record = { receipts: [{ id: 'a', type: 'inventory.add' }, { id: 'b', type: RESOLVE, summary: '[Rolls] cue', data: { v2: { result: result() } } }] };
    assert.equal(resolveOf(record).rounds.length, 1);
    assert.equal(resolveOf(record, [{ receipts: ['b'] }]), null);
    assert.equal(resolveOf({ receipts: [] }), null);
});

test('the model: arrows on the last action aimed at the name, status for who fought, the foes line', () => {
    const model = panelModel({ resolve: readResolve(result()), state: after, before, roleOf });
    const lines = model.rounds[0].lines;
    assert.deepEqual(lines.map(line => line.arrows), [['Wessel Scratched'], ['Sluice Rat A Wounded'], ['Sluice Rat B Hurt', 'Ren Stamina Tired']]);
    assert.deepEqual(model.status.map(who => who.name), ['Wessel', 'Ren']);
    assert.deepEqual(model.status[0].rows.map(row => [row.key, row.word]), [['health', 'Scratched'], ['mana', 'Steady'], ['stamina', 'Tired']]);
    // (PINNED CHANGE, FIGHT-FIX 1 addendum: the Foes line lists only the groups that took part in this reply's rolls; "Sluice Rats ×4" did not roll)
    assert.deepEqual(model.foes.map(foe => foe.text), ['Sluice Rat A · Lv 5: Wounded', 'Sluice Rat B · Lv 5: Hurt']);
});

test('the header says which exchanges', () => {
    assert.equal(headerText({ rounds: [{ n: 2 }] }), 'Combat · Exchange 2');
    assert.equal(headerText({ rounds: [{ n: 1 }, { n: 3 }] }), 'Combat · Exchanges 1–3');
    assert.equal(headerText({ rounds: [] }), 'Check');
});

test('the panel: short lines, the coloured result word, (26 vs 16), the arrow, aligned bars and the foes line', () => {
    const { node } = panel({ index: 4 });
    assert.equal(node.getAttribute('data-ss-screen'), 'rpg/battle-log', 'a root of the look, so the tokens reach it');
    assert.equal(node.querySelector('.rpg-bl-title').textContent, 'Combat · Exchange 2');
    assert.equal(node.querySelector('.rpg-bl-order').textContent, 'Turn order: Sluice Rat A > Wessel > Ren');
    assert.equal(node.querySelector('.rpg-bl-round-title').textContent, 'Round 2');
    assert.deepEqual(node.querySelectorAll('.rpg-act-text').map(line => line.textContent), [
        'Sluice Rat A attacks Wessel — Hit (15 vs 12) → Wessel Scratched',
        'Wessel uses Iron Breath on Sluice Rat A — Success (26 vs 16) → Sluice Rat A Wounded',
        'Ren uses Spark on Sluice Rat B — Success at a cost (17 vs 18) → Sluice Rat B Hurt, Ren Stamina Tired',
    ]);
    assert.deepEqual(node.querySelectorAll('.rpg-out').map(word => word.className), ['rpg-out rpg-out-fail', 'rpg-out rpg-out-success', 'rpg-out rpg-out-cost']);
    assert.equal(node.querySelector('.rpg-skill').textContent, 'Iron Breath');
    const wessel = node.querySelector('.rpg-bl-who[data-who="Wessel"]');
    assert.deepEqual(wessel.querySelectorAll('.rpg-bl-stat').map(cell => cell.querySelector('.rpg-bl-word').textContent), ['Scratched · 4/5', 'Steady · 3/4', 'Tired · 2/4']);
    assert.equal(wessel.querySelector('.rpg-bl-health .rpg-bl-track').style.getPropertyValue('--rpg-fill'), '0.8');
    assert.equal(wessel.querySelector('.rpg-bl-mana .rpg-bl-track').style.getPropertyValue('--rpg-fill'), '0.75');
    assert.equal(node.querySelector('.rpg-bl-foes').textContent, 'FoesSluice Rat A · Lv 5: Wounded · Sluice Rat B · Lv 5: Hurt');   // (PINNED CHANGE: only the groups that rolled)
});

// A foe's attack read from the attacker's side: the recorded outcome is the party's, so a party fail is a Hit, a cost a Graze, a success a Block.
test('a foe\'s attack says Hit, Grazed or Blocked in the outcome\'s colour, the foe\'s total first; the party\'s acts and checks are as they were', () => {
    const doc = setupDom();
    const line = (outcome, foeTotal, pcTotal) => ({ kind: 'foe', outcome, skill: null, pc: pc('Wessel', 'agi', { total: pcTotal }), foe: foe('Sluice Rat A', { total: foeTotal }) });
    const model = panelModel({ resolve: readResolve({ rounds: [{ n: 1, lines: [line('fail', 19, 12), line('cost', 15, 14), line('success', 15, 23),
        { kind: 'act', outcome: 'fail', skill: 'Iron Breath', pc: pc('Wessel', 'str', { total: 9 }), foe: foe('Sluice Rat A', { total: 14 }) }] }],
        checks: [{ kind: 'check', outcome: 'fail', skill: 'Stealth', dc: 15, pc: pc('Ren', 'dex', { total: 8 }) }] }), state: after, before, roleOf });
    const node = buildPanel(doc, model);
    assert.deepEqual(node.querySelectorAll('.rpg-act-text').map(item => item.textContent.replace(/ → .*$/, '')), [
        'Ren — Stealth: 8 vs 15 — Fail',
        'Sluice Rat A attacks Wessel — Hit (19 vs 12)',
        'Sluice Rat A attacks Wessel — Grazed (15 vs 14)',
        'Sluice Rat A attacks Wessel — Blocked (15 vs 23)',
        'Wessel uses Iron Breath on Sluice Rat A — Fail (9 vs 14)',
    ]);
    assert.deepEqual(node.querySelectorAll('.rpg-out').map(word => word.className), ['rpg-out rpg-out-fail', 'rpg-out rpg-out-cost', 'rpg-out rpg-out-success', 'rpg-out rpg-out-fail']);
    const css = readFileSync(new URL('../../../../src/v2/lean-rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-out-fail \{[^}]*--ss-bad/);
    assert.match(css, /\.rpg-out-cost \{[^}]*--ss-warn/);
    assert.match(css, /\.rpg-out-success \{[^}]*--ss-good/);
});

test('the Status bars use the same resource colours and dulling as the Party bars', () => {
    const { node, model } = panel();
    const tones = rows => rows.map(row => [row.key, row.tone]);
    // Wessel: Scratched 4/5, Steady 3/4, Tired 2/4. Ren: Hurt 3/5, Drained-ish 2/4, Tired 2/4.
    assert.deepEqual(tones(model.status[0].rows), [['health', 'good'], ['mana', 'good'], ['stamina', 'warn']]);
    assert.deepEqual(tones(model.status[1].rows), [['health', 'warn'], ['mana', 'warn'], ['stamina', 'warn']]);
    const cells = who => node.querySelectorAll(`.rpg-bl-who[data-who="${who}"] .rpg-bl-stat`);
    assert.deepEqual(cells('Wessel').map(cell => cell.className.split(' ').filter(name => name.startsWith('rpg-bl-tone-'))), [['rpg-bl-tone-good'], ['rpg-bl-tone-good'], ['rpg-bl-tone-warn']]);
    assert.deepEqual(cells('Wessel').map(cell => cell.className.split(' ').find(name => name.startsWith('rpg-bl-step-'))), ['rpg-bl-step-full', 'rpg-bl-step-full', 'rpg-bl-step-mid']);
    const bad = panelModel({ resolve: readResolve(result()), state: state({ wessel: { health: 1, mana: 0, stamina: 4 } }), before, roleOf });
    assert.deepEqual(tones(bad.status[0].rows), [['health', 'bad'], ['mana', 'bad'], ['stamina', 'good']]);
    const low = buildPanel(setupDom(), bad).querySelectorAll('.rpg-bl-who[data-who="Wessel"] .rpg-bl-stat');
    assert.deepEqual(low.map(cell => cell.className.split(' ').find(name => name.startsWith('rpg-bl-step-'))), ['rpg-bl-step-low', 'rpg-bl-step-low', 'rpg-bl-step-full']);
    const css = readFileSync(new URL('../../../../src/v2/lean-rpg/view/bars.css', import.meta.url), 'utf8');
    for (const [bar, token] of [['health', 'hp'], ['mana', 'mp'], ['stamina', 'sp']]) assert.match(css, new RegExp(`\\.rpg-bl-${bar} \\{ --rpg-bar: var\\(--ss-${token}\\)`));
    for (const step of ['full', 'mid', 'low']) assert.match(css, new RegExp(`\\.rpg-bl-step-${step} \\.rpg-bl-fill`));
    assert.match(css, /:is\(\.ss-bar-hp, \.ss-bar-sp, \.ss-bar-mp\) \.ss-bar-head/);
    assert.doesNotMatch(css, /^\.ss-bar-(head|value)\s*\{/m, 'the XP and other bars retain their existing layout');
});

test('the breakdown is on tap, for every line', () => {
    const { node } = panel();
    const [rat, wessel, ren] = node.querySelectorAll('.rpg-act');
    const line = wessel.querySelector('.rpg-act-line'), why = wessel.querySelector('.rpg-why');
    assert.equal(why.hidden, true);
    assert.equal(line.getAttribute('aria-expanded'), 'false');
    line.click();
    assert.equal(why.hidden, false);
    assert.equal(why.textContent, 'd20 14 + STR 7 + Class II 4 + Adept 1 = 26 vs d20 9 + 5 + Class I 2 = 16');
    assert.equal(line.getAttribute('aria-expanded'), 'true');
    line.click();
    assert.equal(why.hidden, true);
    assert.match(rat.querySelector('.rpg-why').textContent, /^d20 11 \+ 5 \+ Class I 2 = 15 vs d20 6 \+ AGI 5 \+ Class II 4 = 12$/, 'a foe\'s attack: the attacker\'s roll first');
    assert.match(ren.querySelector('.rpg-why').textContent, / · cornered$/);
});

test('the header folds the panel and says so', () => {
    const folds = [];
    const { node } = panel({ onFold: on => folds.push(on) });
    const head = node.querySelector('.rpg-bl-head'), body = node.querySelector('.rpg-bl-body');
    assert.equal(body.hidden, false);
    head.click();
    assert.equal(body.hidden, true);
    assert.equal(head.getAttribute('aria-expanded'), 'false');
    assert.ok(node.classList.contains('rpg-bl-folded'));
    head.click();
    assert.equal(body.hidden, false);
    assert.deepEqual(folds, [true, false]);
    assert.equal(panel({ folded: true }).node.querySelector('.rpg-bl-body').hidden, true);
});

test('a check is one line, the breakdown on tap', () => {
    const doc = setupDom();
    const model = panelModel({ resolve: readResolve({ checks: [{ kind: 'check', outcome: 'success', skill: 'Stealth', difficulty: 'normal', dc: 15, pc: pc('Wessel', 'dex', { die: 12, statBonus: 5, classBonus: 2, total: 19 }) }], rounds: [] }), state: after, before, roleOf });
    const node = buildPanel(doc, model);
    assert.equal(node.querySelector('.rpg-bl-title').textContent, 'Check');
    assert.equal(node.querySelector('.rpg-act-text').textContent, 'Wessel — Stealth: 19 vs 15 — Success');
    assert.equal(node.querySelectorAll('.rpg-bl-status').length, 0, 'no fight, no status');
    node.querySelector('.rpg-act-line').click();
    assert.match(node.querySelector('.rpg-why').textContent, /d20 12 \+ DEX 5 \+ Class II 2 = 19 vs DC 15/);
});

test('the panel draws the stop line after the rounds and the Receipt row last, and neither for a record without a stop', () => {
    const doc = setupDom();
    const { stop: _s, pace: _p, rules: _r, ...old } = result();
    const plain = buildPanel(doc, panelModel({ resolve: readResolve(old), state: after, before, roleOf }));
    assert.equal(plain.querySelector('.rpg-bl-stop'), null);
    assert.equal(plain.querySelector('.rpg-bl-receipt'), null);
    const resolve = { ...readResolve(result()), stop: 'pace', pace: 'careful', flow: 2, cap: 8, board: false, receipt: 'Told cue.' };
    const node = buildPanel(doc, panelModel({ resolve, state: after, before, roleOf }));
    const stop = node.querySelector('.rpg-bl-stop');
    assert.match(stop.textContent, /^Ended: careful pace allows 1 exchange\./);
    assert.equal(stop.querySelector('small').textContent.startsWith('The fight goes on next reply.'), true);
    const body = node.children.at(-1);
    assert.equal(body.children.at(-1).className, 'rpg-bl-receipt');
});

test('an areaAll skill tells its one contest on the first group only; the other groups\' lines do not repeat "vs"', () => {
    const area = (name, slot, group, extra = {}) => ({ kind: 'act', type: 'magic', outcome: 'success', skill: 'Flash', area: true, aoe: true, aoeGroup: group, aoeAgainst: 'Sluice Rat A',
        pc: pc('Wessel', 'int', { total: 21 }), foe: foe(name, { slot, total: 12 }), ...extra });
    const raw = { ...result(), rounds: [{ n: 1, decisive: false, lines: [area('Sluice Rat A', 1, 1), area('Sluice Rat B', 2, 2, { aoeFollowup: true })] }] };
    const node = buildPanel(setupDom(), panelModel({ resolve: readResolve(raw), state: after, before, roleOf }));
    const lines = node.querySelectorAll('.rpg-act-text').map(row => row.textContent).filter(text => /Flash/u.test(text));
    assert.equal(lines.length, 2, JSON.stringify(lines));
    assert.match(lines[0], /\(21 vs 12\)/u);
    assert.doesNotMatch(lines[1], /vs/u);
});
