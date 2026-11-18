// The game Trackers editor (ST-GTRACK): the meter presets list and one preset's page (fields, meters with range, bands and drift, stages with
// their needs, a meter rename that follows into the stages), the empty states, and the data modules as checked JSON rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-trackers.js';
import { validatePack } from '../../../packs/validate.js';
import { apply } from '../../../studio/model/edits.js';

const BASE = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));
const PRESET = { id: 'bond', title: 'Bond', meters: [{ id: 'trust', name: 'Trust', min: -100, max: 100, start: 0, bands: [{ at: -50, word: 'wary' }, { at: 50, word: 'close' }] },
    { id: 'fear', name: 'Fear', min: 0, max: 100, start: 10, drift: { toward: 0, perDay: 2 } }], stages: [{ id: 'trusted', name: 'Trusted', needs: [{ meter: 'trust', at: 60 }], milestone: 'They trust you now.' }] };
const MODULE = { slug: 'tally', name: 'Tally of favours', schema: 1, stateVersion: 1, scope: 'chat', state: { count: { type: 'int', min: 0, max: 10, default: 0 } },
    kinds: { owe: { op: '+', labels: {}, effects: [{ op: 'add', path: ['count'], value: 1, bounds: 'clamp' }] } } };

function makePack({ presets = true, modules = true } = {}) {
    const pack = structuredClone(BASE);
    pack.requires.capabilities = [...(pack.requires.capabilities ?? []), 'data-modules-v1'];
    if (presets) pack.content.meterPresets = [structuredClone(PRESET)];
    if (modules) pack.content.dataModules = [structuredClone(MODULE)];
    return pack;
}

function setup(opts = {}) {
    installFakeDom();
    const pack = makePack(opts);
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'game', legacy: false, refs: null, problems: opts.problems ?? [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return { ok: true }; }, go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = key => {
        const host = globalThis.document.createElement('div');
        host.append(...editSection({ key, where: 'content', value: pack.content[key], count: pack.content[key].length }, ctx));
        return host;
    };
    return { pack, calls, ctx, draw };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const preset = (opts = {}) => setup({ ...opts, focus: { rec: 'meterPresets.0', path: opts.path ?? null } });
const change = (input, value) => { input.value = value; input.dispatch('change'); };

test('the fixture game pack passes the pack check', () => {
    assert.equal(validatePack(JSON.stringify(makePack())).ok, true);
});

test('the presets list shows each preset with its counts and opens it with Go to; data modules list below', () => {
    const { calls, draw } = setup();
    const page = draw('meterPresets');
    const rows = page.querySelectorAll('.st-preset');
    assert.equal(rows.length, 1);
    assert.match(rows[0].textContent, /Bond/);
    assert.match(rows[0].textContent, /bond · 2 meters · 1 stage/);
    rows[0].click();
    assert.deepEqual(calls.go, [['trackers', 'meterPresets.0']]);
    assert.equal(page.querySelector('.st-modules'), null);
    assert.match(draw('dataModules').querySelector('.st-module').textContent, /Tally of favours.*tally · kept per chat/);
});

test('with no meterPresets key the data modules section shows "No meter presets", and adding one creates the list', () => {
    const { calls, draw } = setup({ presets: false });
    const page = draw('dataModules');
    assert.match(page.textContent, /No meter presets/);
    assert.match(page.textContent, /up to 4 presets of 6 meters/);
    page.querySelector('.st-add').click();
    assert.deepEqual(calls.commit[0][0].op, 'set');
    assert.deepEqual(calls.commit[0][0].path, ['content', 'meterPresets']);
    assert.equal(calls.commit[0][0].value[0].id, 'new-preset');
    assert.deepEqual(calls.go[0], ['trackers', 'meterPresets.0']);
});

test('with no dataModules key the presets section shows "No data modules"; four presets is the most', () => {
    const { draw, pack } = setup({ modules: false });
    assert.match(draw('meterPresets').textContent, /No data modules/);
    pack.content.meterPresets = [0, 1, 2, 3].map(n => ({ ...structuredClone(PRESET), id: `p${n}` }));
    const page = draw('meterPresets');
    assert.equal(page.querySelector('.st-add').hasAttribute('disabled'), true);
    assert.match(page.textContent, /4 presets is the most/);
});

test('a data module opens as a JSON row, and Apply is one set patch at the module\'s path', () => {
    const { calls, draw } = setup();
    const page = draw('dataModules');
    page.querySelector('.st-dmjson').click();
    const box = page.querySelector('.st-jsonin');
    assert.match(box.value, /"slug": "tally"/);
    box.value = box.value.replace('Tally of favours', 'Favours owed'); box.dispatch('input');
    page.querySelector('.st-apply').click();
    assert.equal(calls.commit.at(-1)[0].op, 'set');
    assert.deepEqual(calls.commit.at(-1)[0].path, ['content', 'dataModules', 0]);
    assert.equal(calls.commit.at(-1)[0].value.name, 'Favours owed');
    box.value = '{ "slug": '; box.dispatch('input');
    assert.equal(page.querySelector('.st-apply').disabled, true);
});

test('a module\'s problems show on its row, and Go to opens its JSON at the field', () => {
    const { draw } = setup({ focus: { rec: 'dataModules.0', path: ['kinds'] }, problems: [{ path: 'content.dataModules[0].kinds', message: 'Missing required field "kinds".' }] });
    const page = draw('dataModules');
    assert.match(page.querySelector('.st-module').textContent, /✕ 1/);
    assert.ok(page.querySelector('.st-jsonin').classList.contains('st-at'));
    assert.match(page.textContent, /Missing required field/);
});

test('the preset page edits its fields as set patches; with a preset open the data modules section draws nothing', () => {
    const { calls, draw } = preset();
    const page = draw('meterPresets');
    assert.match(page.textContent, /Preset 1 of 1/);
    change(field(page, 'title').querySelector('input'), 'Bonds');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'meterPresets', 0, 'title'], value: 'Bonds' }]);
    assert.equal(draw('dataModules').childNodes.length, 0);
});

test('a meter opens below its row; numbers out of range are refused in words, bands and drift are written as the checker reads them', () => {
    const { calls, draw } = preset();
    const page = draw('meterPresets');
    page.querySelector('[data-item="meters.0"] .st-open').click();
    const fresh = page.querySelector('.st-rec');
    assert.ok(field(fresh, 'meters.0.min'));
    const start = field(fresh, 'meters.0.start');
    change(start.querySelector('input'), '150');
    assert.equal(calls.commit.length, 0);
    assert.match(start.querySelector('.st-problem').textContent, /from -100 to 100/);
    change(start.querySelector('input'), '20');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'meterPresets', 0, 'meters', 0, 'start'], value: 20 }]);
    const bands = field(fresh, 'meters.0.bands');
    change(bands.querySelector('input.kadd'), 'trusting');
    assert.match(bands.querySelector('.st-problem').textContent, /value and a word/);
    const before = calls.commit.length;
    bands.querySelector('[aria-label="Remove trusting"]').click();
    assert.equal(bands.querySelector('.st-problem'), null);
    assert.equal(calls.commit.length, before + 1);
    change(bands.querySelector('input.kadd'), '80 devoted');
    assert.deepEqual(calls.commit.at(-1)[0].value, [{ at: -50, word: 'wary' }, { at: 50, word: 'close' }, { at: 80, word: 'devoted' }]);
    const [toward, perDay] = field(fresh, 'meters.0.drift').querySelectorAll('input');
    change(toward, '0');
    assert.match(field(fresh, 'meters.0.drift').querySelector('.st-problem').textContent, /1 or more a day/);
    change(perDay, '3');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'meterPresets', 0, 'meters', 0, 'drift'], value: { toward: 0, perDay: 3 } }]);
});

test('renaming a meter renames it in the stages\' needs in the same step; a reserved or taken id is refused', () => {
    const { calls, draw } = preset({ path: ['meters', 0, 'id'] });
    const page = draw('meterPresets');
    const id = field(page, 'meters.0.id').querySelector('input');
    assert.ok(id.classList.contains('st-at'));
    change(id, 'stage');
    assert.match(page.querySelector('p.st-problem').textContent, /NPC State keeps for itself/);
    change(id, 'fear');
    assert.match(page.querySelector('p.st-problem').textContent, /already "fear"/);
    assert.equal(calls.commit.length, 0);
    change(id, 'faith');
    assert.deepEqual(calls.commit[0], [{ op: 'set', path: ['content', 'meterPresets', 0, 'meters', 0, 'id'], value: 'faith' },
        { op: 'set', path: ['content', 'meterPresets', 0, 'stages', 0, 'needs', 0, 'meter'], value: 'faith' }]);
});

test('a meter a stage needs cannot be removed; moving and adding meters are patches', () => {
    const { calls, draw } = preset();
    const page = draw('meterPresets');
    page.querySelector('[data-item="meters.0"] .st-remove').click();
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('p.st-problem').textContent, /"Trusted" needs the meter "trust"/);
    page.querySelector('[data-item="meters.1"] .st-remove').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'meterPresets', 0, 'meters', 1] }]);
    page.querySelector('[aria-label="Move Trust down"]').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'move', path: ['content', 'meterPresets', 0, 'meters', 0], to: 1 }]);
    page.querySelector('.st-add-meters').click();
    assert.deepEqual(calls.commit.at(-1)[0].path, ['content', 'meterPresets', 0, 'meters', 2]);
    assert.equal(calls.commit.at(-1)[0].value.id, 'meter');
});

test('a stage\'s needs are typed as "meter value" pairs; a bad pair is refused in words', () => {
    const { calls, draw } = preset({ path: ['stages', 0, 'needs'] });
    const needs = field(draw('meterPresets'), 'stages.0.needs');
    assert.equal(needs.querySelector('input').value, 'trust 60');
    change(needs.querySelector('input'), 'trust lots');
    assert.match(needs.querySelector('.st-problem').textContent, /not a meter and a value/);
    change(needs.querySelector('input'), 'trust 40, fear -20');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'meterPresets', 0, 'stages', 0, 'needs'], value: [{ meter: 'trust', at: 40 }, { meter: 'fear', at: -20 }] }]);
});

test('the form\'s patches apply cleanly and keep the pack valid', () => {
    const { calls, draw, pack } = preset({ path: ['meters', 0, 'id'] });
    const page = draw('meterPresets');
    change(field(page, 'meters.0.id').querySelector('input'), 'faith');
    change(field(page, 'meters.0.start').querySelector('input'), '25');
    const after = calls.commit.reduce((doc, patches) => { const done = apply(doc, patches); assert.equal(done.ok, true, done.refusal); return done.doc; }, { doc: pack, portraits: [] });
    assert.equal(after.doc.content.meterPresets[0].stages[0].needs[0].meter, 'faith');
    assert.equal(validatePack(JSON.stringify(after.doc)).ok, true);
});

test('Delete asks once; deleting the only preset takes the key out; Duplicate copies with a free id', () => {
    const { calls, draw } = preset();
    draw('meterPresets').querySelector('.st-dup').click();
    assert.deepEqual(calls.commit.at(-1)[0].path, ['content', 'meterPresets', 1]);
    assert.equal(calls.commit.at(-1)[0].value.id, 'bond-copy');
    const page = draw('meterPresets');
    page.querySelector('.st-del').click();
    page.querySelector('.st-sure').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'meterPresets'] }]);
    assert.deepEqual(calls.go.at(-1), ['trackers']);
});

test('a format 3 pack, or a section that is not a list of records, is drawn read-only', () => {
    const legacy = setup({ ctx: { legacy: true } });
    assert.equal(legacy.draw('meterPresets').querySelector('.st-preset'), null);
    installFakeDom();
    const odd = editSection({ key: 'dataModules', where: 'content', value: { not: 'a list' }, count: 1 }, { legacy: false, commit: () => ({ ok: true }), keep: () => ({}), problems: [] })[0];
    assert.equal(odd.querySelector('.st-module'), null);
});
