// The world events form (ST-EVENTS): the list and its filters, one event's page, the strict grammar helpers (requires, after, effects, outcomes),
// rename through the reference index, new, duplicate and delete, and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { checkLine, editSection } from '../../../studio/edit/events.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { apply } from '../../../studio/model/edits.js';
import { openDoc } from '../../../studio/model/doc.js';
import { validatePack } from '../../../packs/validate.js';

const WORLD = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil-world/pack.json', import.meta.url), 'utf8'));
const EVENTS = WORLD.content.worldEvents;
const C = WORLD.content;

function setup(opts = {}) {
    installFakeDom();
    const pack = opts.pack ?? WORLD;
    const calls = { commit: [], go: [] };
    const keeps = opts.keeps ?? {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: opts.problems ?? [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return { ok: true }; }, go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const key = opts.key ?? 'worldEvents';
    const value = pack.content[key];
    const draw = () => editSection({ key, where: 'content', value, count: Array.isArray(value) ? value.length : 0 }, ctx)[0];
    return { calls, ctx, keeps, draw };
}
const open = (index, extra = {}) => setup({ focus: { rec: `worldEvents.${index}`, path: null }, ...extra });
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const add = (row, text) => { const box = row.querySelector('input.kadd'); box.value = text; box.dispatch('keydown', { key: 'Enter' }); };
const last = calls => calls.commit.at(-1);

test('checkLine reads each kind of line with the validator\'s own checks', () => {
    assert.equal(checkLine(C, 'entry', 'stampede@border-kingdoms'), null);
    assert.match(checkLine(C, 'entry', 'nope@isbro').message, /"nope" is not a condition this pack declares/);
    assert.equal(checkLine(C, 'entry', 'fired:bw-isbro-burns'), null);
    assert.match(checkLine(C, 'entry', 'fired:nothing').message, /not an event in content.worldEvents/);
    assert.match(checkLine(C, 'end', 'stampede@border-kingdoms').message, /a condition is not allowed here/);
    assert.equal(checkLine(C, 'end', 'power:wendhild-court >= 10'), null);
    assert.match(checkLine(C, 'anchor', 'power:wendhild-court >= 10').message, /a threshold is not allowed here/);
    assert.equal(checkLine(C, 'after', 'fired:tide-turning + 5 days'), null);
    assert.match(checkLine(C, 'after', 'start + soon').message, /"soon" is not a duration/);
    assert.equal(checkLine(C, 'set', 'burned@isbro: 1 year'), null);
    assert.match(checkLine(C, 'clear', 'burned@isbro: 1 year').message, /carries a duration/);
    assert.equal(checkLine(C, 'set', 'burned@place').level, 'error');
    assert.equal(checkLine(C, 'set', 'burned@place', { recurring: true }), null, 'a recurring event may name the place it picks');
    assert.equal(checkLine(C, 'weight', '60'), null);
    assert.match(checkLine(C, 'weight', 'power:nobody').message, /no power with that id/);
    assert.equal(checkLine(C, 'where', 'isbro'), null);
    assert.match(checkLine(C, 'where', 'zzz-nowhere').message, /not a place, region or realm/);
    assert.match(checkLine(C, 'duration', 'soon').message, /not a duration/);
});

test('the list shows each event with its sub-line and flags, filters by kind and problems, searches, and opens an event', () => {
    const { calls, draw, keeps } = setup({ problems: [{ path: 'content.worldEvents[2].requires[0]', message: 'bad', level: 'error' }] });
    const page = draw();
    assert.match(page.querySelector('.st-counts').textContent, new RegExp(`^${EVENTS.length} events · `));
    assert.equal(page.querySelectorAll('.st-eventrow').length, 40);
    assert.equal(page.querySelector('.st-more').textContent, `Show all ${EVENTS.length}`);
    const first = page.querySelector('[data-rec="worldEvents.0"]');
    assert.match(first.textContent, /bw-who-pays-vote/);
    assert.match(first.textContent, /likely · realm · river-confederacy/);
    assert.match(first.textContent, /3 outcomes/);
    assert.match(page.querySelector('[data-rec="worldEvents.2"] .st-bad').textContent, /✕ 1/);
    page.querySelector('[data-filter="recurring"]').click();
    const recurring = EVENTS.filter(e => e.kind === 'recurring').length;
    assert.equal(page.querySelectorAll('.st-eventrow').length, recurring);
    assert.equal(keeps.events.filter, 'recurring');
    page.querySelector('[data-filter="problems"]').click();
    assert.deepEqual(page.querySelectorAll('.st-eventrow').map(r => r.dataset.rec), ['worldEvents.2']);
    page.querySelector('[data-filter="all"]').click();
    const search = page.querySelector('input.st-search');
    search.value = 'bw-isbro'; search.dispatch('input');
    assert.deepEqual(page.querySelectorAll('.st-eventrow').map(r => r.dataset.rec), ['worldEvents.2']);
    page.querySelector('.st-eventrow').click();
    assert.deepEqual(calls.go.at(-1), ['events', 'worldEvents.2']);
});

test('one event\'s page: the fields, a set and a remove, and a select back to "not set"', () => {
    const { calls, draw } = open(2);
    const page = draw();
    assert.equal(field(page, 'id').querySelector('input').value, 'bw-isbro-burns');
    assert.deepEqual(field(page, 'where').querySelectorAll('.kc').map(c => c.textContent), ['isbro×']);
    assert.equal(field(page, 'window.after').querySelector('input').value, 'fired:tide-turning + 5 days');
    const summary = field(page, 'summary').querySelector('textarea');
    summary.value = 'Isbro burns.'; summary.dispatch('change');
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 2, 'summary'], value: 'Isbro burns.' }]);
    const reach = field(page, 'reach').querySelector('select');
    reach.value = '(not set)'; reach.dispatch('change');
    assert.deepEqual(last(calls), [{ op: 'remove', path: ['content', 'worldEvents', 2, 'reach'] }]);
    const party = field(page, 'even_in_party').querySelector('input') ?? field(page, 'even_in_party').querySelector('button');
    assert.ok(party);
    page.querySelector('.st-back').click();
    assert.deepEqual(calls.go.at(-1), ['events']);
});

test('requires: a line the grammar refuses is kept out with the reason; a good one commits the whole list', () => {
    const { calls, draw } = open(2);
    const page = draw();
    const row = field(page, 'requires');
    add(row, 'nope@isbro');
    assert.equal(calls.commit.length, 0);
    assert.match(row.querySelector('.st-problem').textContent, /"nope" is not a condition/);
    row.querySelector('button[aria-label="Remove nope@isbro"]').click();
    assert.equal(row.querySelector('.st-problem'), null);
    add(row, 'fired:tide-turning');
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 2, 'requires'], value: ['stampede@border-kingdoms', 'fired:tide-turning'] }]);
    const any = field(page, 'pre_empted_by');
    add(any, 'power:wendhild-court >= 10');
    assert.match(any.querySelector('.st-problem').textContent, /threshold is not allowed here/);
});

test('"Pick…" offers the pack\'s ids: a whole anchor is added at once, a condition start waits in the box for its place', () => {
    const { calls, draw } = open(2);
    const page = draw();
    const row = field(page, 'requires');
    row.querySelector('.st-pickline').click();
    const items = globalThis.document.querySelectorAll('.slist button');
    assert.ok(items.some(b => b.dataset.id === 'fired:bw-who-pays-vote'));
    assert.ok(items.some(b => b.dataset.id === 'set:stampede@'));
    assert.ok(items.some(b => b.dataset.id === 'power:wendhild-court >= '));
    items.find(b => b.dataset.id === 'fired:bw-who-pays-vote').click();
    assert.deepEqual(last(calls)[0].value, ['stampede@border-kingdoms', 'fired:bw-who-pays-vote']);
    const set = field(page, 'effects.set');
    set.querySelector('.st-pickline').click();
    globalThis.document.querySelectorAll('.slist button').find(b => b.dataset.id === 'stampede@').click();
    assert.equal(set.querySelector('input.kadd').value, 'stampede@');
    assert.equal(calls.commit.length, 1);
});

test('window: "Not before" is checked as it is typed, commits the window, and a pick keeps the offset', () => {
    const { calls, draw } = open(2);
    const page = draw();
    const row = field(page, 'window.after');
    const input = row.querySelector('input');
    input.value = 'fired:nothing'; input.dispatch('input');
    assert.match(row.querySelector('.st-problem').textContent, /not an event/);
    input.value = 'start + 10 days'; input.dispatch('input');
    assert.equal(row.querySelector('.st-problem'), null);
    input.dispatch('change');
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 2, 'window'], value: { after: 'start + 10 days', within: '60 days' } }]);
    row.querySelector('.st-pickline').click();
    globalThis.document.querySelectorAll('.slist button').find(b => b.dataset.id === 'fired:bw-who-pays-vote').click();
    assert.deepEqual(last(calls)[0].value, { after: 'fired:bw-who-pays-vote + 5 days', within: '60 days' });
});

test('effects: sets and clears are grammar lines; powers, scores and facts are chips that become their objects', () => {
    const { calls, draw } = open(2);
    const page = draw();
    add(field(page, 'effects.clear'), 'burned@isbro: 1 year');
    assert.equal(calls.commit.length, 0);
    assert.match(field(page, 'effects.clear').querySelector('.st-problem').textContent, /carries a duration/);
    const scores = field(page, 'effects.scores');
    assert.deepEqual(scores.querySelectorAll('.kc').map(c => c.textContent), ['north-readiness -5×']);
    add(scores, 'tide-pressure +3');
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 2, 'effects'], value: { ...EVENTS[2].effects, scores: { 'north-readiness': -5, 'tide-pressure': 3 } } }]);
    add(field(page, 'effects.powers'), 'river-council lots');
    assert.match(field(page, 'effects.powers').querySelector('.st-problem').textContent, /is not a power and a change/);
    add(field(page, 'effects.facts'), 'isbro-gone: Isbro is ash.');
    assert.deepEqual(last(calls)[0].value.facts, [{ id: 'isbro-gone', text: 'Isbro is ash.' }]);
});

test('likelier if: a test and odds; the test is checked by the grammar', () => {
    const { calls, draw } = open(1);
    const page = draw();
    const row = field(page, 'likelier_if');
    assert.deepEqual(row.querySelectorAll('.kc').map(c => c.textContent), ['stampede@bluewatch-reach ×2×']);
    add(row, 'nope@isbro ×2');
    assert.match(row.querySelector('.st-problem').textContent, /"nope" is not a condition/);
    row.querySelector('button[aria-label="Remove nope@isbro ×2"]').click();
    add(row, 'fired:bw-isbro-burns ×0.5');
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 1, 'likelier_if'], value: { 'stampede@bluewatch-reach': '×2', 'fired:bw-isbro-burns': '×0.5' } }]);
});

test('outcomes: each has its name, weight (checked) and effects; add, move, and removing the last takes the list out', () => {
    const { calls, draw } = open(0);
    const page = draw();
    assert.equal(page.querySelectorAll('.st-outcome').length, 3);
    const weight = field(page, 'outcomes[2].weight').querySelector('input');
    assert.equal(weight.value, '60');
    weight.value = 'power:nobody'; weight.dispatch('input');
    assert.match(field(page, 'outcomes[2].weight').querySelector('.st-problem').textContent, /no power with that id/);
    weight.value = '40'; weight.dispatch('change');
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 0, 'outcomes', 2, 'weight'], value: 40 }]);
    add(field(page, 'outcomes[1].effects.set'), 'burned@isbro: 10 days');
    assert.deepEqual(last(calls)[0].path, ['content', 'worldEvents', 0, 'outcomes', 1, 'effects']);
    assert.deepEqual(last(calls)[0].value.set, ['burned@isbro: 10 days']);
    page.querySelector('[data-outcome="0"] .st-odown').click();
    assert.deepEqual(last(calls), [{ op: 'move', path: ['content', 'worldEvents', 0, 'outcomes', 0], to: 1 }]);
    page.querySelector('.st-oadd').click();
    assert.deepEqual(last(calls), [{ op: 'insert', path: ['content', 'worldEvents', 0, 'outcomes', 3], value: { name: 'outcome 4', weight: 1 } }]);
    const one = { ...WORLD, content: { ...C, worldEvents: [{ ...EVENTS[0], outcomes: [EVENTS[0].outcomes[0]] }] } };
    const solo = open(0, { pack: one });
    solo.draw().querySelector('.st-oremove').click();
    assert.deepEqual(last(solo.calls), [{ op: 'remove', path: ['content', 'worldEvents', 0, 'outcomes'] }]);
});

test('ends when: "over at once" writes instant; off, it lasts for a duration or until an anchor or threshold holds', () => {
    const { calls, draw } = open(2);
    const page = draw();
    assert.equal(field(page, 'ends_when.for'), null);
    const toggle = field(page, 'ends_when').querySelector('input') ?? field(page, 'ends_when').querySelector('button');
    toggle.click();
    assert.deepEqual(last(calls), [{ op: 'set', path: ['content', 'worldEvents', 2, 'ends_when'], value: { for: '30 days' } }]);
    const lasting = open(10).draw();
    assert.equal(field(lasting, 'ends_when.for').querySelector('input').value, '1 season');
    add(field(lasting, 'ends_when.any_of'), 'stampede@isbro');
    assert.match(field(lasting, 'ends_when.any_of').querySelector('.st-problem').textContent, /a condition is not allowed here/);
});

test('renaming the id rewrites every fired: and stage: that names it; a bad id is refused in words', () => {
    const at = EVENTS.findIndex(e => e.id === 'tide-turning');
    const { calls, draw } = open(at);
    const page = draw();
    const input = field(page, 'id').querySelector('input');
    input.value = 'Bad Id'; input.dispatch('change');
    assert.equal(calls.commit.length, 0);
    assert.ok(field(page, 'id').querySelector('.st-problem'));
    input.value = 'the-turning'; input.dispatch('change');
    const done = apply(openDoc({ doc: WORLD }), calls.commit[0]);
    assert.equal(done.ok, true);
    assert.equal(done.doc.doc.content.worldEvents[2].window.after, 'fired:the-turning + 5 days');
    const after = buildRefs(done.doc.doc);
    assert.equal(after.uses.some(u => u.kind === 'event' && u.id === 'tide-turning'), false);
    assert.equal(after.uses.some(u => u.dangling), false);
});

test('"used by" lists the records that name the event, and Go to opens them', () => {
    const at = EVENTS.findIndex(e => e.id === 'tide-turning');
    const { calls, draw } = open(at);
    const used = draw().querySelectorAll('.st-used');
    assert.ok(used.some(row => row.dataset.rec === 'worldEvents.2'));
    used.find(row => row.dataset.rec === 'worldEvents.2').querySelector('button').click();
    assert.deepEqual(calls.go.at(-1), ['events', 'worldEvents.2']);
    const lonely = open(0, { pack: { ...WORLD, content: { ...C, worldEvents: [EVENTS[0]] } } }).draw();
    assert.match(lonely.textContent, /No other record names this event \(as fired:bw-who-pays-vote\)/);
});

test('New event makes a record the pack check takes; Duplicate gives a free id; Delete asks first', () => {
    const { calls, draw } = setup();
    draw().querySelector('.st-new').click();
    const made = last(calls)[0];
    assert.deepEqual([made.op, made.path], ['insert', ['content', 'worldEvents', EVENTS.length]]);
    assert.deepEqual(calls.go.at(-1), ['events', `worldEvents.${EVENTS.length}`]);
    assert.equal(validatePack(JSON.stringify({ ...WORLD, content: { ...C, worldEvents: [...EVENTS, made.value] } })).ok, true);
    const one = open(2);
    const page = one.draw();
    page.querySelector('.st-dup').click();
    assert.equal(last(one.calls)[0].value.id, 'bw-isbro-burns-copy');
    assert.deepEqual(last(one.calls)[0].path, ['content', 'worldEvents', 3]);
    page.querySelector('.st-del').click();
    assert.equal(one.calls.commit.length, 1, 'Delete only asks');
    page.querySelector('.st-sure').click();
    assert.deepEqual(last(one.calls), [{ op: 'remove', path: ['content', 'worldEvents', 2] }]);
    assert.deepEqual(one.calls.go.at(-1), ['events']);
});

test('a focus with a field path marks its control, and a checker problem shows under the field', () => {
    const page = open(2, { focus: { rec: 'worldEvents.2', path: ['window', 'after'] }, problems: [{ path: 'content.worldEvents[2].requires[0]', message: 'Event: requires is wrong.', level: 'error' }] }).draw();
    assert.ok(field(page, 'window.after').querySelector('input').classList.contains('st-at'));
    assert.equal(field(page, 'requires').querySelector('.st-problem').textContent, 'Event: requires is wrong.');
});

test('a legacy pack, the dated events key, or a list that is not all records falls back to the read-only cards', () => {
    assert.equal(setup({ ctx: { legacy: true } }).draw().querySelector('.st-eventrow'), null);
    const dated = { ...WORLD, content: { ...C, events: [{ id: 'old', date: '1-1-1' }] } };
    assert.equal(setup({ pack: dated, key: 'events' }).draw().querySelector('.st-eventrow'), null);
    const odd = { ...WORLD, content: { ...C, worldEvents: [EVENTS[0], 'x'] } };
    assert.equal(setup({ pack: odd }).draw().querySelector('.st-eventrow'), null);
});
