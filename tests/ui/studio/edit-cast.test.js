// The cast editor (ST-CAST): the list and its filters, one person's page (companion with every field, figure light), edits as patches,
// where they start and their birthday, ties through the cast picker, an id rename through the reference index, and the format 3 fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/cast.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { TIE_TAGS } from '../../../packs/limits.js';

const PACK = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const section = pack => ({ key: 'cast', where: 'content', value: pack.content.cast, count: pack.content.cast.length });

function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(PACK);
    opts.edit?.(pack);
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = () => editSection(section(pack), ctx)[0];
    return { pack, calls, ctx, draw };
}
const open = (n, opts = {}) => setup({ ...opts, focus: { rec: `cast.${n}`, path: null } });
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const picks = () => globalThis.document.querySelectorAll('.slist button');

test('the list shows each person with kind and role, counts them, filters and searches, and opens a record with Go to', () => {
    const { calls, draw } = setup();
    const page = draw();
    assert.match(page.querySelector('.st-counts').textContent, /2 people · 1 companion · 1 figure/);
    const rows = page.querySelectorAll('.st-crow');
    assert.deepEqual(rows.map(row => row.dataset.rec), ['cast.0', 'cast.1']);
    assert.match(rows[0].textContent, /Wren Ashby/);
    assert.match(rows[0].textContent, /Companion · lamplighter/);
    page.querySelector('[data-filter="figure"]').click();
    const filtered = draw();
    assert.deepEqual(filtered.querySelectorAll('.st-crow').map(row => row.dataset.rec), ['cast.1']);
    filtered.querySelector('[data-filter="all"]').click();
    const again = draw();
    const search = again.querySelector('input.st-search');
    search.value = 'lamp'; search.dispatch('input');
    assert.deepEqual(again.querySelectorAll('.st-crow').map(row => row.dataset.rec), ['cast.0']);
    again.querySelector('.st-crow').click();
    assert.deepEqual(calls.go, [['cast', 'cast.0']]);
});

test('New person inserts a figure with a free id and name and opens it', () => {
    const { calls, draw } = setup({ edit: pack => pack.content.cast.push({ kind: 'figure', id: 'new-person', name: 'New person' }) });
    draw().querySelector('.st-new').click();
    assert.deepEqual(calls.commit[0], [{ op: 'insert', path: ['content', 'cast', 3], value: { kind: 'figure', id: 'new-person-2', name: 'New person 2' } }]);
    assert.deepEqual(calls.go[0], ['cast', 'cast.3']);
});

test('a person\'s page shows name, kind and role; edits are one patch each, and switching kind writes the kind', () => {
    const { calls, draw } = open(0);
    const page = draw();
    assert.equal(page.querySelector('.st-rec').dataset.rec, 'cast.0');
    assert.match(page.textContent, /Person 1 of 2/);
    const name = field(page, 'name').querySelector('input');
    name.value = ' Wren Ash '; name.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'name'], value: 'Wren Ash' }]);
    field(page, 'kind').querySelectorAll('button')[1].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'kind'], value: 'figure' }]);
    const role = field(page, 'role').querySelector('input');
    role.value = ''; role.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'cast', 0, 'role'] }]);
});

test('a companion shows every field behind "more fields"; a figure only the light ones until Show every field', () => {
    const companion = open(0);
    const page = companion.draw();
    assert.equal(field(page, 'voice'), null);
    assert.match(page.querySelector('.st-morebar').textContent, /21 more fields: id, other names, look, start, birthday…/);
    page.querySelector('.st-moreshow').click();
    const opened = companion.draw();
    for (const key of ['id', 'aliases', 'look', 'start.place', 'start.goal', 'start.routine', 'birthday', 'protected', 'voice', 'history', 'homeBase', 'canDieUnmet']) assert.ok(field(opened, key), key);
    const figure = open(1);
    figure.draw().querySelector('.st-moreshow').click();
    const light = figure.draw();
    for (const key of ['id', 'aliases', 'look', 'start.place', 'birthday', 'protected']) assert.ok(field(light, key), key);
    assert.equal(field(light, 'voice'), null);
    assert.match(light.querySelector('.st-morebar').textContent, /A figure needs only a name; 15 companion fields are not shown/);
    light.querySelector('.st-every').click();
    assert.ok(field(figure.draw(), 'voice'));
});

test('a figure shows a companion field it already carries; age keeps a number as a number', () => {
    const { calls, draw } = open(1, { edit: pack => { pack.content.cast[1].age = 60; } });
    draw().querySelector('.st-moreshow').click();
    const page = draw();
    const age = field(page, 'age').querySelector('input');
    assert.equal(age.value, '60');
    age.value = '61'; age.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 1, 'age'], value: 61 }]);
    age.value = 'about 300'; age.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 1, 'age'], value: 'about 300' }]);
});

test('aliases, look and birthday are set at their paths; the start place is picked from the places, and clearing the last start field removes start', () => {
    const { calls, draw } = open(0, { ctx: { keep: id => (id === 'cast:cast.0' ? { more: true } : {}) } });
    const page = draw();
    const alias = field(page, 'aliases').querySelector('input.kadd');
    alias.value = 'Wren'; alias.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'aliases'], value: ['Wren'] }]);
    const birthday = field(page, 'birthday').querySelector('input');
    birthday.value = 'Icewane 27'; birthday.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'birthday'], value: 'Icewane 27' }]);
    const goal = field(page, 'start.goal').querySelector('input');
    goal.value = 'Find the lost lamp'; goal.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'start', 'goal'], value: 'Find the lost lamp' }]);
    field(page, 'start.place').querySelector('button').click();
    assert.deepEqual(picks().map(b => b.dataset.id), ['', ...PACK.content.places.map(place => place.id)]);
    picks()[2].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'start', 'place'], value: PACK.content.places[1].id }]);

    const lone = open(0, { edit: pack => { pack.content.cast[0].start = { routine: 'Rounds' }; }, ctx: { keep: () => ({ more: true }) } });
    const routine = field(lone.draw(), 'start.routine').querySelector('input');
    routine.value = ''; routine.dispatch('change');
    assert.deepEqual(lone.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'cast', 0, 'start'] }]);
    const none = open(1, { ctx: { keep: () => ({ more: true }) } });
    field(none.draw(), 'start.place').querySelector('button').click();
    picks()[1].click();
    assert.deepEqual(none.calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 1, 'start'], value: { place: PACK.content.places[0].id } }]);
});

test('Add a tie picks a person from the cast, then the kind of tie; a row changes its kind, moves and is removed', () => {
    const { calls, draw } = open(0);
    const page = draw();
    page.querySelector('.st-ties .addrow button').click();
    assert.deepEqual(picks().map(b => b.dataset.id), ['old-tam']);
    picks()[0].click();
    assert.deepEqual(picks().map(b => b.dataset.id), [...TIE_TAGS]);
    picks().find(b => b.dataset.id === 'friend').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'ties'], value: [{ with: 'old-tam', tag: 'friend' }] }]);

    const tied = open(0, { edit: pack => { pack.content.cast.push({ kind: 'figure', id: 'ma', name: 'Ma Ashby' }); pack.content.cast[0].ties = [{ with: 'old-tam', tag: 'friend' }, { with: 'ma', tag: 'kin' }]; } });
    const rows = tied.draw().querySelectorAll('.st-ties .subrow');
    assert.match(rows[0].textContent, /Old Tam/);
    assert.match(rows[1].textContent, /kin · ma/);
    rows[0].querySelector('.st-tietag').click();
    picks().find(b => b.dataset.id === 'rival').click();
    assert.deepEqual(tied.calls.commit.at(-1), [{ op: 'set', path: ['content', 'cast', 0, 'ties', 0, 'tag'], value: 'rival' }]);
    rows[0].querySelector('button[aria-label="Move Old Tam down"]').click();
    assert.deepEqual(tied.calls.commit.at(-1), [{ op: 'move', path: ['content', 'cast', 0, 'ties', 0], to: 1 }]);
    rows[1].querySelector('button[aria-label="Remove Ma Ashby"]').click();
    assert.deepEqual(tied.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'cast', 0, 'ties', 1] }]);
    tied.draw().querySelector('.st-ties .addrow button').click();
    picks()[1].click();
    picks().find(b => b.dataset.id === 'ally').click();
    assert.deepEqual(tied.calls.commit.at(-1), [{ op: 'insert', path: ['content', 'cast', 0, 'ties', 2], value: { with: 'ma', tag: 'ally' } }]);
});

test('Used by lists who names this person and opens them; renaming the id rewrites them; a taken id is refused in words', () => {
    const { calls, draw } = open(1, { edit: pack => { pack.content.cast[0].ties = [{ with: 'old-tam', tag: 'friend' }]; }, ctx: { keep: id => (id === 'cast:cast.1' ? { more: true } : {}) } });
    const page = draw();
    const used = page.querySelector('.st-usedby');
    assert.match(used.textContent, /Used by · 1/);
    assert.match(used.textContent, /Wren Ashby/);
    used.querySelector('.st-open').click();
    assert.deepEqual(calls.go.at(-1), ['cast', 'cast.0']);
    const id = field(page, 'id').querySelector('input');
    id.value = 'wren'; id.dispatch('change');
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('p.st-problem').textContent, /already the id/);
    id.value = 'tam'; id.dispatch('change');
    const paths = calls.commit[0].map(patch => `${patch.path.join('.')}=${JSON.stringify(patch.value)}`);
    assert.ok(paths.includes('content.cast.1.id="tam"'));
    assert.ok(paths.some(path => path.startsWith('content.cast.0.ties') && path.includes('tam')));
});

test('a refused change says why; Duplicate copies without aliases; Delete asks first; Back goes to the list', () => {
    const { calls, draw } = open(0, { refuse: true, edit: pack => { pack.content.cast[0].aliases = ['Wren']; } });
    const page = draw();
    const name = field(page, 'name').querySelector('input');
    name.value = 'X'; name.dispatch('change');
    assert.equal(page.querySelector('p.st-problem').textContent, 'No.');
    page.querySelector('.st-dup').click();
    const copy = calls.commit.at(-1)[0];
    assert.deepEqual([copy.op, copy.path, copy.value.id, copy.value.name, copy.value.aliases], ['insert', ['content', 'cast', 1], 'wren-copy', 'Wren Ashby (copy)', undefined]);
    const ok = open(0);
    ok.draw().querySelector('.st-del').click();
    assert.equal(ok.calls.commit.length, 0);
    ok.draw().querySelector('.st-sure').click();
    assert.deepEqual(ok.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'cast', 0] }]);
    assert.deepEqual(ok.calls.go.at(-1), ['cast']);
    const back = open(1);
    back.draw().querySelector('.st-back').click();
    assert.deepEqual(back.calls.go, [['cast']]);
});

test('checker problems show under their field and on the list; fields with no form are named for the JSON row; a format 3 pack is read-only', () => {
    const problems = [{ path: 'content.cast[0].birthday', message: 'birthday must be a month and a day.' }, { path: 'content.cast[0].ties[0].tag', message: 'tag must be one of the tie kinds.' }];
    const { draw } = open(0, { ctx: { problems, keep: () => ({ more: true }) }, edit: pack => { pack.content.cast[0].ties = [{ with: 'old-tam', tag: 'pal' }]; pack.content.cast[0].tastes = [{ item: 'tea', like: 'loves', why: 'warmth' }]; } });
    const page = draw();
    assert.match(field(page, 'birthday').querySelector('.st-problem').textContent, /month and a day/);
    assert.match(page.querySelector('.st-ties').textContent, /one of the tie kinds/);
    assert.match(page.querySelector('.st-extra').textContent, /^Also in this person, only in the JSON below: tastes\.$/);
    const list = setup({ ctx: { problems } }).draw();
    assert.match(list.querySelector('[data-rec="cast.0"]').textContent, /✕ 2/);
    const old = setup({ ctx: { legacy: true } }).draw();
    assert.equal(old.querySelector('.st-crow'), null);
    assert.ok(old.querySelector('.st-rec'));
});

test('a focus on a field below the record opens the more fields and marks its control', () => {
    const { draw } = setup({ focus: { rec: 'cast.0', path: ['start', 'place'] } });
    const button = field(draw(), 'start.place').querySelector('button');
    assert.ok(button.classList.contains('st-at'));
});
