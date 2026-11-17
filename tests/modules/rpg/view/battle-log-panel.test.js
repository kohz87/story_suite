import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { buildPanel, headerText, outcomeOf, panelModel, readResolve, resolveOf, rollText } from '../../../../modules/rpg/view/battle-log.js';
import { RESOLVE } from '../../../../modules/rpg/index.js';
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

test('the header says which exchanges', () => {
    assert.equal(headerText({ rounds: [{ n: 2 }] }), 'Combat · Exchange 2');
    assert.equal(headerText({ rounds: [{ n: 1 }, { n: 3 }] }), 'Combat · Exchanges 1–3');
    assert.equal(headerText({ rounds: [] }), 'Check');
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
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-out-fail \{[^}]*--ss-bad/);
    assert.match(css, /\.rpg-out-cost \{[^}]*--ss-warn/);
    assert.match(css, /\.rpg-out-success \{[^}]*--ss-good/);
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
