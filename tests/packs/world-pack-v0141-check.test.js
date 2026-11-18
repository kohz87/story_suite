// The install check up to spec v0.14.10 (the new Ersveil's fields): open conditions, regions, start.world, reserved ids, date anchors and `on`,
// weight expressions, thresholds in likelier_if, open templates (menu, ladder direction, arc, per, fallback), `@@place`, gates, a number age.
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, sample } from './helpers/world-pack-sample.js';

const clone = value => JSON.parse(JSON.stringify(value));
const event = (world, id) => world.content.worldEvents.find(each => each.id === id);
const run = change => { const world = clone(sample); change(world); const result = check(world); return { ok: result.ok, errors: (result.errors ?? []).map(e => e.message), warnings: (result.warnings ?? []).map(w => w.message), pack: result.pack }; };
const refused = (change, pattern) => { const { ok, errors } = run(change); assert.equal(ok, false, 'should be refused'); assert.ok(errors.some(m => pattern.test(m)), `${pattern} not in ${JSON.stringify(errors)}`); };
const accepted = change => { const r = run(change); assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };
const open = (extra = {}) => ({ template: 'wild-stirs', scope: 'place', severity: 'minor', reach: 'regional', needs: ['grain-dear@region'], per: 'region per season', cooldown: '1 season per place', open: { menu: { set: { pick: 1, of: ['unrest'], at: '@place', for: '10 days' } } }, summary: 'Stirs.', ...extra });

test('a condition may be open: true and the flag is kept; open: false is refused', () => {
    const r = accepted(w => { w.content.conditions.find(c => c.name === 'unrest').open = true; });
    assert.equal(r.pack.content.conditions.find(c => c.name === 'unrest').open, true);
    refused(w => { w.content.conditions[0].open = false; }, /open must be true/);
});

test('content.regions: declared regions are kept; a place in an undeclared region, a bad record and a start place outside the pack are refused', () => {
    assert.deepEqual(accepted(() => {}).pack.content.regions[0], { id: 'the-marches', name: 'The Marches', aliases: ['the March'] });
    refused(w => { w.content.places[1].region = 'nowhere'; }, /"nowhere" is not a declared region id/);
    refused(w => { w.content.start = { place: 'nowhere' }; }, /not the id of a place in this pack/);
    refused(w => { w.content.regions[0].extra = 1; }, /"extra" is not a region field/);
    refused(w => { w.content.regions.push({ id: 'the-marches', name: 'Again' }); }, /two regions share the id/);
});

test('a pack that declares no regions gets one warning, not a refusal', () => {
    const r = accepted(w => { delete w.content.regions; });
    assert.ok(r.warnings.some(m => /declares no content.regions/.test(m)));
});

test('place, region, route and realm are reserved: refused as the id of a place, region or realm', () => {
    refused(w => { w.content.places[1].id = 'place'; }, /"place" is a reserved word/);
    refused(w => { w.content.regions.push({ id: 'realm', name: 'Realm' }); }, /"realm" is a reserved word/);
    refused(w => { w.content.realms[0].id = 'region'; }, /"region" is a reserved word/);
});

test('start.world: conditions and facts are checked and kept; its facts count as written', () => {
    const r = accepted(w => { w.content.start = { world: { set: ['crown-contested@Highmark Empire: 1 year'], facts: ['letter-found'] } }; });
    assert.deepEqual(r.pack.start.world, { set: ['crown-contested@Highmark Empire: 1 year'], facts: ['letter-found'] });
    assert.ok(!r.warnings.some(m => /letter-found/.test(m)), 'a start fact counts as written');
    refused(w => { w.content.start = { world: { set: ['nothing@Highmark Empire'] } }; }, /"nothing" is not a condition/);
    refused(w => { w.content.start = { world: { set: ['unrest@place'] } }; }, /@place binds to the place picked/);
    refused(w => { w.content.start = { world: { facts: ['Bad Id'] } }; }, /fact ids/);
    refused(w => { w.content.start = { world: { other: 1 } }; }, /"other" is not a start.world field/);
});

test('@@place means the picked place (a template, a recurring event); a one-off still refuses a placeholder', () => {
    accepted(w => { w.content.templates[0].sets = ['unrest@@place: 10 days']; w.content.templates[0].needs = ['grain-dear@@region']; });
    accepted(w => { event(w, 'famine').effects.set = ['grain-dear@@region: 1 season']; });
    refused(w => { event(w, 'succession-crisis').effects.set = ['unrest@@place: 3 days']; }, /binds to the place picked/);
});

test('date anchors: a number or a month name is read; a bad shape is refused; no calendar is read in a world pack', () => {
    accepted(w => { event(w, 'war-of-faiths').requires.push('date:612-Goldwane-12'); event(w, 'war-of-faiths').ends_when.any_of.push('date:612-2-30'); });
    refused(w => { event(w, 'war-of-faiths').requires.push('date:612-July'); }, /fixed date is date:<year>-<month>-<day>/);
    refused(w => { w.content.calendar = { era: 'CY', months: [{ name: 'Goldwane', days: 30 }] }; }, /belongs in a game pack/);
});

test('"on" is a one-off on one fixed date: window, chance, another certainty, a recurring kind or a bad date are refused', () => {
    const on = { id: 'term-ends', kind: 'one-off', certainty: 'set-in-motion', reach: 'realm', where: ['Highmark Empire'], on: 'date:612-07-30', ends_when: 'instant', summary: 'The term ends.' };
    const add = extra => w => { w.content.worldEvents.push({ ...on, ...extra }); };
    assert.equal(accepted(add({})).pack.content.worldEvents.at(-1).on, 'date:612-07-30');
    refused(add({ window: { within: '5 days' } }), /"on" already is the window/);
    refused(add({ chance: '50% over the window' }), /remove "chance"/);
    refused(add({ certainty: 'likely' }), /fires with certainty set-in-motion/);
    refused(add({ kind: 'recurring', cooldown: '1 season per place', where: 'where conditions fit' }), /"on" is for a one-off/);
    refused(add({ on: '612-07-30' }), /"on" is a fixed date/);
});

test('outcome weights: sums and differences of refs and numbers; * , brackets, a negative literal and an unknown ref are refused', () => {
    const weight = value => w => { event(w, 'succession-crisis').outcomes[0].weight = value; };
    accepted(weight('200 - power:ashen-veil'));
    accepted(weight('power:ashen-veil + score:highmark-stability - 20'));
    accepted(weight('standing:ashen-veil + 10'));
    refused(weight('power:ashen-veil * 2'), /only \+ and -/);
    refused(weight('(power:ashen-veil + 1)'), /only \+ and -/);
    refused(weight(-5), /0 or more/);
    refused(weight('power:ashen-veil + -5'), /negative literal/);
    refused(weight('power:ashen-veil+score:tide-pressure'), /no power with that id|spaces around the sign/);
    refused(weight('power:ghost + 5'), /no power with that id/);
    refused(weight('score:ghost'), /no score with that id/);
});

test('thresholds: allowed as likelier_if and less_if keys (ranges checked), still refused in pre_empted_by', () => {
    accepted(w => { Object.assign(event(w, 'succession-crisis').likelier_if, { 'score:tide-pressure >= 30': '×2' }); event(w, 'succession-crisis').less_if['power:ashen-veil <= 10'] = '×0.5'; });
    refused(w => { event(w, 'succession-crisis').likelier_if['score:tide-pressure >= 300'] = '×2'; }, /outside the range/);
    refused(w => { event(w, 'succession-crisis').pre_empted_by.push('score:tide-pressure >= 30'); }, /threshold is not allowed here/);
});

test('open templates: per, open menu, arc, fallback, requires_any, likelier_if and less_if are kept', () => {
    const full = open({ requires_any: ['grain-dear@region', 'unrest@place'], likelier_if: { 'score:tide-pressure >= 30': '×2' }, less_if: { 'fact:regency-declared': '×0.5' }, arc: { steps: [2, 4] }, fallback: { sets: ['unrest@place: 10 days'] },
        open: { menu: { powers: { pick: 1, of: 'any', delta: [-5, 5] }, scores: { pick: 1, of: ['tide-pressure'], delta: [-5, 5] }, set: { pick: 1, of: ['unrest'], at: '@place', for: '10 days' }, clear: { pick: 1, of: ['unrest'] }, ladder: { of: ['grain-dear', 'harvest-failed'], step: 1, direction: 'up' }, cast: { pick: 1, of: 'figures', move: '@region' } }, writes_facts: ['stir-noted'] } });
    const r = accepted(w => { w.content.templates.push(full); });
    assert.deepEqual(r.pack.content.templates.at(-1), full);
});

test('open templates: each rule that is broken is refused', () => {
    const add = extra => w => { w.content.templates.push(open(extra)); };
    const menu = menuPart => add({ open: { menu: menuPart } });
    refused(add({ per: 'every day' }), /per must read like/);
    refused(add({ open: { menu: {} } }), /at least one pick/);
    refused(add({ open: { menu: { teleport: {} } } }), /"teleport" is not a menu key/);
    refused(menu({ powers: { pick: 1, of: 'any', delta: [-5, 20] } }), /within -10..10/);
    refused(menu({ powers: { pick: 1, of: ['ghost'], delta: [-5, 5] } }), /"ghost" is not a power id/);
    refused(menu({ scores: { pick: 1, of: 'any', delta: [-5, 5] } }), /must be a non-empty list of score ids/);
    refused(menu({ set: { pick: 1, of: ['ghost'], at: '@place', for: '10 days' } }), /"ghost" is not a condition/);
    refused(menu({ set: { pick: 1, of: ['grain-dear'], at: '@place', for: '10 days' } }), /region-scope condition but the menu sets at @place/);
    refused(menu({ set: { pick: 1, of: ['unrest'], at: '@nowhere', for: '10 days' } }), /at must be "@place"/);
    refused(menu({ set: { pick: 1, of: ['unrest'], at: '@place', for: 'soon' } }), /for must be a duration/);
    refused(menu({ ladder: { of: ['unrest'], step: 1 } }), /at least two conditions/);
    refused(menu({ ladder: { of: ['unrest', 'harvest-failed'], direction: 'sideways' } }), /direction must be/);
    refused(menu({ cast: { pick: 1, of: ['ghost'], move: '@region' } }), /"ghost" is not a cast id/);
    refused(menu({ cast: { pick: 1, of: 'figures', move: 'the moon' } }), /move must be/);
    refused(add({ arc: { steps: [2, 4] }, open: undefined }), /cannot start an arc/);
    refused(add({ arc: { steps: [1, 9] } }), /steps/);
    refused(add({ fallback: { kills: [] } }), /"kills" is not a fallback field/);
    refused(add({ fallback: { sets: ['ghost@Highmark Empire'] } }), /not a condition/);
    refused(add({ requires_any: ['ghost@region'] }), /not a condition/);
});

test('a protected person in a cast menu is a warning (code never picks them)', () => {
    const r = accepted(w => { w.content.templates.push(open({ open: { menu: { cast: { pick: 1, of: ['sir-lothar'], move: '@region' } } } })); });
    assert.ok(r.warnings.some(m => /protected person/.test(m)));
});

test('arc-ended:<template>@<ref> names a template of the pack', () => {
    accepted(w => { w.content.templates.push(open()); event(w, 'war-of-faiths').requires.push('arc-ended:wild-stirs@the-marches'); });
    refused(w => { event(w, 'war-of-faiths').requires.push('arc-ended:ghost@the-marches'); }, /"ghost" is not a template/);
});

test('gates join every kind of test with and / or (a set: anchor may name a place); cast age is a number or text', () => {
    const r = accepted(w => {
        w.content.cast[1].secrets[0].gate = 'stage >= "Trusted" and set:unrest@Highmark Capital or fact:letter-found and place:Ledgerford and quote:the lantern was never lit';
        w.content.cast[0].age = 41; w.content.cast[1].age = 'about 300';
    });
    assert.equal(r.pack.content.cast[0].age, '41');
    assert.equal(r.pack.content.cast[1].age, 'about 300');
    const ghost = run(w => { w.content.cast[1].secrets[0].gate = 'stage >= "Trusted" and set:ghost@Highmark Capital'; });
    assert.ok(ghost.warnings.some(m => /"ghost" is not a condition/.test(m)), 'a bad term refuses that person alone');
    const bad = run(w => { w.content.cast[0].age = -3; });
    assert.ok(bad.warnings.some(m => /age as a number must be a whole number/.test(m)));
});

test('"1 year" is a duration for a condition and for start.world', () => {
    accepted(w => { w.content.conditions.find(c => c.name === 'crown-contested').fades = '1 year'; event(w, 'succession-crisis').effects.set = ['regent-named@Highmark Empire: 1 year']; });
});
