// The install check for world events that know where the party is: in: / near: terms and waits_for. Also: the Studio's rename.
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, sample } from './helpers/world-pack-sample.js';
import { checkPairing } from '../../packs/validate.js';
import { buildRefs } from '../../studio/model/refs.js';
import { renameId } from '../../studio/model/rename.js';
import { checkLine } from '../../studio/edit/events.js';

const clone = value => JSON.parse(JSON.stringify(value));
const event = (world, id) => world.content.worldEvents.find(each => each.id === id);
const template = world => world.content.templates[0];
const run = change => { const world = clone(sample); change(world); return check(world); };
const errorsOf = change => { const result = run(change); return result.ok ? [] : result.errors.map(error => error.message); };

const accepted = [
    ['in: and near: in requires and requires_any, by id or name', w => { event(w, 'war-of-faiths').requires.push('near:the-marches'); event(w, 'war-of-faiths').requires_any = ['in:Highmark Core']; }],
    ['terms as likelier_if and less_if keys', w => { Object.assign(event(w, 'succession-crisis'), { likelier_if: { 'near:the-marches': '×2' }, less_if: { 'in:highmark-core': '×0.5' } }); }],
    ['@region on a recurring event', w => { event(w, 'famine').likelier_if = { 'near:@region': '×3' }; }],
    ['@region on a one-off with a where list', w => { event(w, 'war-of-faiths').requires.push('in:@region'); }],
    ['@region on a template', w => { template(w).likelier_if = { 'near:@region': '×3' }; template(w).requires = ['near:@region']; }],
    ['waits_for "near" with a where list', w => { event(w, 'war-of-faiths').waits_for = 'near'; }],
    ['waits_for a list of regions', w => { event(w, 'war-of-faiths').waits_for = { near: ['the-marches'] }; }],
    ['waits_for in a list of regions, with no where', w => { delete event(w, 'war-of-faiths').where; event(w, 'war-of-faiths').waits_for = { in: ['the-marches', 'highmark-core'] }; }],
];
for (const [name, change] of accepted) {
    test(`accepted: ${name}`, () => {
        const result = run(change);
        assert.equal(result.ok, true, JSON.stringify(result.errors));
    });
}

const refused = [
    ['an unknown region', w => { event(w, 'war-of-faiths').requires.push('in:atlantis'); }, /"atlantis" is not a region of this pack/],
    ['a place where a region belongs', w => { event(w, 'war-of-faiths').requires.push('near:ledgerford'); }, /"ledgerford" is not a region/],
    ['an unknown region in a modifier', w => { event(w, 'famine').likelier_if = { 'near:atlantis': '×2' }; }, /not a region/],
    ['a term with no region', w => { event(w, 'war-of-faiths').requires.push('near:'); }, /names no region/],
    ['@region with no where list', w => { delete event(w, 'war-of-faiths').where; event(w, 'war-of-faiths').requires.push('in:@region'); }, /needs a recurring event, a template or an event with a "where" list/],
    ['another placeholder', w => { event(w, 'famine').requires.push('in:@place'); }, /"@place" is not a region/],
    ['a term in pre_empted_by', w => { event(w, 'succession-crisis').pre_empted_by.push('in:the-marches'); }, /in: \/ near: is not allowed here/],
    ['a term in ends_when.any_of', w => { event(w, 'war-of-faiths').ends_when.any_of.push('near:the-marches'); }, /not allowed here/],
    ['a term in a template\'s needs', w => { template(w).needs = ['near:@region']; }, /not allowed here/],
    ['a term as window.after', w => { event(w, 'war-of-faiths').window.after = 'in:the-marches'; }, /not an anchor kind/],
    ['waits_for another word', w => { event(w, 'war-of-faiths').waits_for = 'soon'; }, /waits_for must be/],
    ['waits_for with both keys', w => { event(w, 'war-of-faiths').waits_for = { near: ['the-marches'], in: ['the-marches'] }; }, /waits_for must be/],
    ['waits_for an empty list', w => { event(w, 'war-of-faiths').waits_for = { near: [] }; }, /waits_for must be/],
    ['waits_for an unknown region', w => { event(w, 'war-of-faiths').waits_for = { near: ['atlantis'] }; }, /"atlantis" is not a region/],
    ['waits_for "near" with no where list', w => { delete event(w, 'war-of-faiths').where; event(w, 'war-of-faiths').waits_for = 'near'; }, /read against the event's "where" list/],
    ['waits_for with no window', w => { delete event(w, 'war-of-faiths').window; event(w, 'war-of-faiths').waits_for = 'near'; }, /needs a "window"/],
    ['waits_for on a recurring event', w => { event(w, 'famine').waits_for = { near: ['the-marches'] }; }, /a recurring event has no window to wait in/],
    ['waits_for beside "on"', w => { const w1 = event(w, 'war-of-faiths'); delete w1.window; delete w1.chance; delete w1.certainty; w1.on = 'date:612-07-30'; w1.waits_for = 'near'; }, /one fixed day/],
];
for (const [name, change, pattern] of refused) {
    test(`refused: ${name}`, () => {
        const problems = errorsOf(change);
        assert.ok(problems.some(message => pattern.test(message)), `${pattern} not in ${JSON.stringify(problems)}`);
    });
}

test('the pairing check passes the terms by, and the checked event keeps waits_for', () => {
    const result = run(w => { event(w, 'war-of-faiths').waits_for = 'near'; event(w, 'war-of-faiths').requires.push('near:@region'); });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(event(result.pack, 'war-of-faiths').waits_for, 'near');
    assert.deepEqual(checkPairing(result.pack, null).errors.filter(error => /near:/.test(error.message)), []);
});

test('Studio: renaming a region rewrites in: / near: terms and waits_for; @region is left alone; the line check takes the terms', () => {
    const doc = clone(sample);
    Object.assign(event(doc, 'war-of-faiths'), { waits_for: { near: ['the-marches'] }, requires: ['in:the-marches', 'near:@region'], likelier_if: { 'near:the-marches': '×2' } });
    const out = renameId(buildRefs(doc), doc, 'region', 'the-marches', 'the-borders');
    assert.equal(out.ok, true);
    const written = Object.fromEntries(out.patches.map(patch => [patch.path.join('.'), patch.value]));
    const at = `content.worldEvents.${doc.content.worldEvents.indexOf(event(doc, 'war-of-faiths'))}`;
    assert.equal(written[`${at}.waits_for.near.0`], 'the-borders');
    assert.equal(written[`${at}.requires.0`], 'in:the-borders');
    assert.equal(written[`${at}.requires.1`], undefined);
    assert.deepEqual(written[`${at}.likelier_if`], { 'near:the-borders': '×2' });
    assert.equal(checkLine(sample.content, 'entry', 'near:the-marches'), null);
    assert.equal(checkLine(sample.content, 'entry', 'in:@region', { whereList: true }), null);
    assert.equal(checkLine(sample.content, 'entry', 'in:@region').level, 'error');
});
