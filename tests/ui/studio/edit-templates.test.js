// The templates editor (ST-TEMPL): the list with its find box and filters, one template's record page, edits as patches, the id rename through
// the reference index, the open-template menu (picks, id pickers, delta ranges −10..10, the arc), "used by", delete and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/templates.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { validatePack } from '../../../packs/validate.js';
import { apply } from '../../../studio/model/edits.js';

const BASE = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const TEMPLATES = [
    { template: 'lamp-riot', scope: 'place', severity: 'minor', reach: 'local', sets: ['lamps-out@the-fen: 10 days'], less_if: { 'lamps-out@the-fen': '×0.5' }, cooldown: '1 season per place', summary: 'Riots in {place}.' },
    { template: 'open-guild-move', scope: 'place', severity: 'minor', reach: 'regional', per: 'region per season', open: { menu: { powers: { pick: 1, of: 'any', delta: [-5, 5] }, set: { pick: 1, of: ['lamps-out'], at: '@region', for: '30 days' } } },
        arc: { steps: [2, 4] }, fallback: { sets: ['lamps-out@region: 10 days'] }, summary: 'The guild moves in {region}.' },
];
const section = pack => ({ key: 'templates', where: 'content', value: pack.content.templates, count: pack.content.templates.length });

function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(BASE);
    pack.content.templates = structuredClone(TEMPLATES);
    if (opts.used) pack.content.worldEvents = [{ id: 'after-move', requires: ['arc-ended:open-guild-move'] }];
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: opts.problems ?? [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = () => editSection(section(pack), ctx)[0];
    return { pack, calls, ctx, draw };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const open = (n = 1, opts = {}) => setup({ ...opts, focus: { rec: `templates.${n}`, path: opts.path ?? null } });
const sheet = () => globalThis.document.querySelectorAll('.slist button');

test('the fixture templates pass the pack check, so the editor starts from a clean pack', () => {
    const pack = structuredClone(BASE);
    pack.content.templates = structuredClone(TEMPLATES);
    assert.equal(validatePack(JSON.stringify(pack)).ok, true);
});

test('the list shows each template with its line, marks the open one, filters and finds, and opens a record with Go to', () => {
    const { calls, draw } = setup({ problems: [{ path: 'content.templates[0].cooldown', message: 'bad' }] });
    const page = draw();
    const rows = page.querySelectorAll('.st-trow');
    assert.deepEqual(rows.map(r => r.dataset.rec), ['templates.0', 'templates.1']);
    assert.match(rows[0].textContent, /place · minor · local — Riots/);
    assert.match(rows[0].textContent, /✕ 1/);
    assert.match(rows[1].textContent, /open/);
    assert.match(page.textContent, /2 templates · 1 open · 1 fixed/);
    page.querySelector('[data-filter="open"]').click();
    assert.deepEqual(page.querySelectorAll('.st-trow').map(r => r.dataset.rec), ['templates.1']);
    page.querySelector('[data-filter="problems"]').click();
    assert.deepEqual(page.querySelectorAll('.st-trow').map(r => r.dataset.rec), ['templates.0']);
    page.querySelector('[data-filter="all"]').click();
    const find = page.querySelector('input.psrch');
    find.value = 'guild'; find.dispatch('input');
    assert.deepEqual(page.querySelectorAll('.st-trow').map(r => r.dataset.rec), ['templates.1']);
    page.querySelector('.st-trow').click();
    assert.deepEqual(calls.go, [['templates', 'templates.1']]);
});

test('New template inserts a record with a free id and opens it', () => {
    const { calls, draw } = setup();
    draw().querySelector('.st-add').click();
    assert.deepEqual(calls.commit[0], [{ op: 'insert', path: ['content', 'templates', 2], value: { template: 'new-template', scope: 'place' } }]);
    assert.deepEqual(calls.go[0], ['templates', 'templates.2']);
});

test('a focused template draws its page; a text edit is one set patch, and a cleared field takes its key out', () => {
    const { calls, draw } = open(0);
    const page = draw();
    assert.equal(page.querySelector('.st-rec').dataset.rec, 'templates.0');
    assert.match(page.textContent, /Template 1 of 2/);
    const summary = field(page, 'summary').querySelector('textarea');
    summary.value = 'Bread riots in {place}.'; summary.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 0, 'summary'], value: 'Bread riots in {place}.' }]);
    const cooldown = field(page, 'cooldown').querySelector('input');
    cooldown.value = ' '; cooldown.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'templates', 0, 'cooldown'] }]);
    const severity = field(page, 'severity').querySelector('select');
    severity.value = 'major'; severity.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 0, 'severity'], value: 'major' }]);
});

test('chip lists write the grammar lines, and odds chips must end in ×N', () => {
    const { calls, draw } = open(0);
    const page = draw();
    const add = field(page, 'needs').querySelector('input.kadd');
    add.value = 'lamps-out@the-fen'; add.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 0, 'needs'], value: ['lamps-out@the-fen'] }]);
    const odds = field(page, 'likelier_if');
    const box = odds.querySelector('input.kadd');
    box.value = 'lamps-out@the-fen 2'; box.dispatch('change');
    assert.equal(calls.commit.length, 1);
    assert.match(odds.querySelector('.st-problem').textContent, /needs odds at the end/);
    const less = field(page, 'less_if');
    less.querySelector('button').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'templates', 0, 'less_if'] }]);
});

test('a delta range within −10..10 is one set patch; outside it, or the wrong way round, it is refused in words', () => {
    const { calls, draw } = open(1);
    const row = field(draw(), 'open.menu.powers.delta');
    assert.match(row.textContent, /−5 to \+5/);
    const [low, high] = row.querySelectorAll('input');
    low.value = '-3'; low.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 1, 'open', 'menu', 'powers', 'delta'], value: [-3, 5] }]);
    high.value = '11'; high.dispatch('change');
    assert.equal(calls.commit.length, 1);
    assert.match(row.querySelector('.st-problem').textContent, /from -10 to 10/);
    high.value = '-4'; high.dispatch('change');
    assert.match(row.querySelector('.st-problem').textContent, /low end comes first/);
    high.value = '10'; high.dispatch('change');
    assert.deepEqual(calls.commit.at(-1)[0].value, [-3, 10]);
    assert.equal(row.querySelector('.st-problem'), null);
});

test('the menu adds and removes picks, its id lists use the picker, and "any power" switches to a list', () => {
    const { calls, draw } = open(1);
    const page = draw();
    assert.deepEqual(page.querySelectorAll('.st-addpick').map(b => b.dataset.pick), ['scores', 'clear', 'ladder', 'cast']);
    page.querySelector('[data-pick="ladder"]').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 1, 'open', 'menu', 'ladder'], value: { of: [], step: 1, direction: 'up' } }]);
    page.querySelector('[data-menu="set"] .st-unpick').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'templates', 1, 'open', 'menu', 'set'] }]);
    field(page, 'open.menu.set.of').querySelector('.st-pickbtn').click();
    const items = sheet();
    assert.deepEqual(items.map(b => b.dataset.id), ['lamps-out']);
    assert.equal(items[0].getAttribute('aria-disabled'), 'true');
    const any = field(page, 'open.menu.powers.of.any').querySelector('input, button, [role="switch"]');
    any.click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 1, 'open', 'menu', 'powers', 'of'], value: [] }]);
});

test('a power list picks from the pack\'s powers; How many must be 1 to 8', () => {
    const { calls, draw, pack } = open(1);
    pack.content.templates[1].open.menu.powers.of = [];
    const page = draw();
    field(page, 'open.menu.powers.of').querySelector('.st-pickbtn').click();
    const items = sheet();
    assert.deepEqual(items.map(b => b.dataset.id), ['lamp-guild']);
    items[0].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 1, 'open', 'menu', 'powers', 'of'], value: ['lamp-guild'] }]);
    const pick = field(page, 'open.menu.powers.pick');
    const box = pick.querySelector('input');
    box.value = '9'; box.dispatch('change');
    assert.equal(calls.commit.length, 1);
    assert.match(pick.querySelector('.st-problem').textContent, /1 to 8/);
    box.value = ''; box.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'templates', 1, 'open', 'menu', 'powers', 'pick'] }]);
});

test('turning a template open adds an empty menu; turning it fixed takes out the menu and the arc in one step', () => {
    const fixed = open(0);
    fixed.draw().querySelector('[data-key="open"] input, [data-key="open"] button').click();
    assert.deepEqual(fixed.calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 0, 'open'], value: { menu: {} } }]);
    const opened = open(1);
    const page = opened.draw();
    page.querySelector('[data-key="open"] input, [data-key="open"] button').click();
    assert.deepEqual(opened.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'templates', 1, 'open'] }, { op: 'remove', path: ['content', 'templates', 1, 'arc'] }]);
    const [low] = field(page, 'arc').querySelectorAll('input');
    low.value = '3'; low.dispatch('change');
    assert.deepEqual(opened.calls.commit.at(-1), [{ op: 'set', path: ['content', 'templates', 1, 'arc'], value: { steps: [3, 4] } }]);
});

test('the patches the form makes apply cleanly and keep the pack valid', () => {
    const { calls, draw, pack } = open(1);
    const [low, high] = field(draw(), 'open.menu.powers.delta').querySelectorAll('input');
    low.value = '-10'; low.dispatch('change');
    high.value = '2'; high.dispatch('change');
    assert.equal(calls.commit.length, 2);
    const after = calls.commit.reduce((doc, patches) => { const done = apply(doc, patches); assert.equal(done.ok, true, done.refusal); return done.doc; }, { doc: pack, portraits: [] });
    const next = after.doc;
    assert.deepEqual(next.content.templates[1].open.menu.powers.delta, [-10, 2]);
    assert.equal(validatePack(JSON.stringify(next)).ok, true);
});

test('renaming the id goes through the reference index, so an arc-ended: use follows; a taken id is refused', () => {
    const { calls, draw } = open(1, { used: true });
    const page = draw();
    const id = field(page, 'template').querySelector('input');
    id.value = 'lamp-riot'; id.dispatch('change');
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('.st-problem').textContent, /lamp-riot/);
    id.value = 'guild-move'; id.dispatch('change');
    const paths = calls.commit[0].map(p => `${p.path.join('.')}=${p.value}`);
    assert.ok(paths.includes('content.templates.1.template=guild-move'));
    assert.ok(paths.includes('content.worldEvents.0.requires.0=arc-ended:guild-move'));
});

test('"used by" lists the events that test the arc and goes to them; a used template cannot be deleted', () => {
    const { calls, draw } = open(1, { used: true });
    const page = draw();
    const used = page.querySelectorAll('.st-used');
    assert.equal(used.length, 1);
    assert.match(used[0].textContent, /after-move/);
    used[0].click();
    assert.deepEqual(calls.go.at(-1), ['events', 'worldEvents.0']);
    page.querySelector('.st-del').click();
    assert.equal(calls.commit.length, 0);
    assert.match(page.textContent, /take those out first/);
});

test('Delete asks once, then removes the record and goes back to the list; Duplicate copies with a free id', () => {
    const { calls, draw } = open(0);
    const page = draw();
    page.querySelector('.st-del').click();
    assert.equal(calls.commit.length, 0);
    page.querySelector('.st-sure').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'templates', 0] }]);
    assert.deepEqual(calls.go.at(-1), ['templates']);
    draw().querySelector('.st-dup').click();
    assert.equal(calls.commit.at(-1)[0].value.template, 'lamp-riot-copy');
    assert.deepEqual(calls.commit.at(-1)[0].path, ['content', 'templates', 1]);
});

test('a problem shows under its field, and Go to marks the deepest control on the path', () => {
    const { draw } = open(1, { path: ['open', 'menu', 'set', 'for'], problems: [{ path: 'content.templates[1].open.menu.set.for', message: 'for must be a duration.' }] });
    const page = draw();
    assert.match(field(page, 'open.menu.set.for').querySelector('.st-problem').textContent, /duration/);
    assert.ok(field(page, 'open.menu.set.for').querySelector('input').classList.contains('st-at'));
});

test('a format 3 pack, or a section that is not a list of records, is drawn read-only', () => {
    const legacy = setup({ ctx: { legacy: true } });
    assert.equal(legacy.draw().querySelector('.st-trow'), null);
    installFakeDom();
    const odd = editSection({ key: 'templates', where: 'content', value: [1, 2], count: 2 }, { legacy: false, commit: () => ({ ok: true }), keep: () => ({}), problems: [] })[0];
    assert.equal(odd.querySelector('.st-trow'), null);
});
