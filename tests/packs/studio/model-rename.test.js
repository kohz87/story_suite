// The Studio's rename (studio/model/rename.js): the patches rewrite the definition and every reference written as the old id (and nothing written as a name),
// apply cleanly through the pure edits, leave no dangling id, keep the author's key order and spacing, and refuse in words. Run on a small pack with every site
// and on every id of every kind in Ersveil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apply } from '../../../studio/model/edits.js';
import { openDoc } from '../../../studio/model/doc.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { renameId } from '../../../studio/model/rename.js';
import { validatePack } from '../../../packs/validate.js';
import { SMALL } from './refs-pack.js';

const ERSVEIL = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil-world/pack.json', import.meta.url), 'utf8'));
const byId = (refs, kind, id) => refs.uses.filter(use => use.kind === kind && use.id === id && use.by === 'id' && use.pack !== 'other');

function renamed(pack, kind, from, to, other = null) {
    const doc = openDoc({ doc: pack });
    const refs = buildRefs(doc, other);
    const result = renameId(refs, doc, kind, from, to);
    assert.ok(result.ok, result.refusal);
    const applied = result.patches.length ? apply(doc, result.patches) : { ok: true, doc };
    assert.ok(applied.ok, applied.refusal);
    return { before: refs, after: buildRefs(applied.doc, other), doc: applied.doc, result, original: doc };
}

test('a place rename rewrites the id, every id reference and the derived route key; names are left alone', () => {
    const { before, after, doc, result } = renamed(SMALL(), 'place', 'fenhold', 'fen-hold');
    assert.equal(byId(after, 'place', 'fenhold').length, 0);
    assert.equal(byId(after, 'place', 'fen-hold').length, byId(before, 'place', 'fenhold').length);
    const content = doc.doc.content;
    assert.equal(content.places[0].id, 'fen-hold');
    assert.equal(content.routes[0].from, 'fen-hold');
    assert.equal(content.routes[1].from, 'Fenhold');
    assert.equal(content.powers[0].holds[0], 'Fenhold');
    assert.equal(content.cast[0].start.place, 'fen-hold');
    assert.deepEqual(content.worldEvents[0].where, ['fen-hold', 'fen-realm', 'the-fen']);
    assert.equal(content.templates[0].open.menu.cast.move, 'Fenhold');
    assert.equal(content.worldEvents[0].likelier_if['set:lamps-out@fen-hold'], '×3');
    assert.ok(result.patches.every(patch => patch.op === 'set'));
});

test('a route key written as an unnamed route is renamed with its place', () => {
    const pack = SMALL();
    pack.content.worldEvents[1].requires.push('lamps-out@fenhold–reedmoor');
    const { doc, after } = renamed(pack, 'place', 'reedmoor', 'reed-moor');
    assert.ok(doc.doc.content.worldEvents[1].requires.includes('lamps-out@fenhold–reed-moor'));
    assert.equal(after.uses.filter(use => use.kind === 'route' && use.id === 'fenhold–reed-moor').length, 1);
    assert.equal(after.uses.some(use => use.dangling), false);
});

test('object keys are rebuilt in their own order; the rest of a string is kept as written', () => {
    const { doc } = renamed(SMALL(), 'condition', 'lamps-out', 'lights-out');
    const event = doc.doc.content.worldEvents[0];
    assert.deepEqual(Object.keys(event.likelier_if), ['score:dread >= 3', 'set:lights-out@fenhold']);
    assert.equal(event.outcomes[0].effects.set[0], 'lights-out@fenhold: 5 days');
    assert.equal(event.requires[0], 'lights-out@the-fen');
    assert.equal(event.ends_when.any_of[1], 'cleared:lights-out@reedmoor');
    assert.equal(event.outcomes[0].effects.cast[0].until, 'cleared:lights-out@the-fen');
    assert.equal(doc.doc.content.lore[0].gate, 'learned:wren/lamp or died:tam and set:lights-out@the-fen and stage of wren >= 2');
    const power = renamed(SMALL(), 'power', 'guild', 'lamp-guild').doc.doc.content.worldEvents[0];
    assert.deepEqual(Object.keys(power.outcomes[0].effects.powers), ['lamp-guild']);
    assert.equal(power.outcomes[0].weight, '100 - power:lamp-guild + standing:dread');
    assert.equal(power.requires[1], 'power:lamp-guild >= 5');
});

test('cast, event, fact, lore, template, region and realm ids follow into gates, anchors and menus', () => {
    const cast = renamed(SMALL(), 'cast', 'tam', 'old-tam').doc.doc.content;
    assert.equal(cast.cast[0].ties[0].with, 'old-tam');
    assert.equal(cast.cast[0].secrets[0].gate, 'fired:flood and meter trust >= 40 of old-tam or fact:lit and place:reedmoor');
    assert.equal(cast.lore[0].gate.includes('died:old-tam'), true);
    assert.deepEqual(cast.templates[0].open.menu.cast.of, ['wren', 'old-tam']);
    const event = renamed(SMALL(), 'event', 'flood', 'high-water').doc.doc.content;
    assert.equal(event.worldEvents[0].window.after, 'fired:high-water + 3 days');
    assert.equal(event.worldEvents[1].requires[0], 'stage:high-water');
    assert.equal(event.cast[0].secrets[0].gate.startsWith('fired:high-water and'), true);
    const fact = renamed(SMALL(), 'fact', 'lit', 'lamps-lit').doc.doc.content;
    assert.equal(fact.worldEvents[0].outcomes[0].effects.facts[0].id, 'lamps-lit');
    assert.equal(fact.worldEvents[0].requires[2], 'fact:lamps-lit + 2 days');
    assert.equal(fact.start.world.facts[0], 'lamps-lit');
    const lore = renamed(SMALL(), 'lore', 'lamp-lore', 'lamp-story').doc.doc.content;
    assert.equal(lore.worldEvents[0].requires_any[0], 'learned:lore/lamp-story');
    const tpl = renamed(SMALL(), 'template', 'thaw', 'thaws').doc.doc.content;
    assert.equal(tpl.worldEvents[1].requires[1], 'arc-ended:thaws@Old Causeway');
    const region = renamed(SMALL(), 'region', 'the-fen', 'fenland').doc.doc.content;
    assert.equal(region.places[0].region, 'fenland');
    assert.equal(region.places[1].region, 'Marsh');
    assert.deepEqual(region.realms[0].regions, ['fenland']);
    assert.equal(region.worldEvents[1].where.region, 'fenland');
    const realm = renamed(SMALL(), 'realm', 'fen-realm', 'fen-lands').doc.doc.content;
    assert.deepEqual(realm.worldEvents[0].where, ['fenhold', 'fen-lands', 'the-fen']);
});

test("a region rename reports the other pack's name cultures instead of leaving them dangling", () => {
    const game = { kind: 'game', content: { names: { fen: { regions: ['the-fen', 'Marsh'] } } } };
    const { result } = renamed(SMALL(), 'region', 'the-fen', 'fenland', game);
    assert.deepEqual(result.elsewhere.map(use => use.path.join('.')), ['content.names.fen.regions.0']);
});

test('refusals say why and change nothing', () => {
    const doc = openDoc({ doc: SMALL() });
    const refs = buildRefs(doc);
    const why = (kind, from, to) => { const r = renameId(refs, doc, kind, from, to); assert.equal(r.ok, false); return r.refusal; };
    assert.match(why('place', 'nowhere', 'x'), /no place "nowhere"/);
    assert.match(why('place', 'fenhold', 'fenhold'), /same as the old/);
    assert.match(why('place', 'fenhold', 'Fen Hold'), /not an id/);
    assert.match(why('place', 'fenhold', 'region'), /reserved/);
    assert.match(why('place', 'fenhold', 'the-fen'), /already the id of a region/);
    assert.match(why('event', 'flood', 'next'), /already the id of a event/);
    assert.match(why('route', 'fenhold–reedmoor', 'Road'), /no name of its own/);
    assert.match(why('route', 'Old Causeway', 'Bad@Road'), /"@"/);
    assert.match(why('colour', 'a', 'b'), /not something with an id/);
});

test('a named route is renamed by its name, and the garbage case does not throw', () => {
    const pack = SMALL();
    pack.content.worldEvents[1].requires.push('lamps-out@Old Causeway');
    const { doc } = renamed(pack, 'route', 'Old Causeway', 'High Causeway');
    assert.equal(doc.doc.content.routes[1].name, 'High Causeway');
    assert.ok(doc.doc.content.worldEvents[1].requires.includes('lamps-out@High Causeway'));
    assert.equal(renameId(buildRefs(null), null, 'place', 'a', 'b').ok, false);
});

test('Ersveil: every id of every kind renames cleanly, leaves nothing behind, and keeps the pack as valid as it was', () => {
    const refs = buildRefs(ERSVEIL);
    const baseline = validatePack(JSON.stringify(ERSVEIL), { files: [] });
    const unknown = problems => (problems.errors ?? []).filter(item => item.code === 'UNKNOWN_REF').length;
    const kinds = Object.keys(refs.defs);
    let done = 0;
    for (const kind of kinds) {
        for (const [n, def] of refs.defs[kind].entries()) {
            if (kind === 'route' && !def.path) continue;
            const to = kind === 'route' ? `${def.id} renamed` : `${def.id}-x`;
            const doc = openDoc({ doc: ERSVEIL });
            const result = renameId(refs, doc, kind, def.id, to);
            assert.ok(result.ok, `${kind} ${def.id}: ${result.refusal}`);
            const applied = apply(doc, result.patches);
            assert.ok(applied.ok, `${kind} ${def.id}: ${applied.refusal}`);
            const after = buildRefs(applied.doc);
            assert.equal(byId(after, kind, def.id).length, 0, `${kind} ${def.id} left behind`);
            assert.equal(byId(after, kind, to).length, byId(refs, kind, def.id).length, `${kind} ${def.id} count`);
            assert.equal(after.uses.filter(use => use.dangling).length, refs.uses.filter(use => use.dangling).length, `${kind} ${def.id} dangling`);
            if (n % 40 === 0) assert.equal(unknown(validatePack(applied.doc.text, { files: [] })), unknown(baseline), `${kind} ${def.id} validator`);
            done += 1;
        }
    }
    assert.ok(done > 600);
});

test('a secret rename rewrites its id and the learned:<person>/<secret> terms of this pack, and refuses in words', () => {
    const pack = SMALL();
    pack.content.worldEvents[0].likelier_if = { 'fired:flood': 3, 'learned:wren/lamp': 2 };
    const { doc } = renamed(pack, 'secret', 'wren/lamp', 'wren/old-lamp');
    assert.equal(doc.doc.content.cast[0].secrets[0].id, 'old-lamp');
    assert.equal(doc.doc.content.lore[0].gate, 'learned:wren/old-lamp or died:tam and set:lamps-out@the-fen and stage of wren >= 2');
    assert.deepEqual(Object.entries(doc.doc.content.worldEvents[0].likelier_if), [['fired:flood', 3], ['learned:wren/old-lamp', 2]]);
    assert.deepEqual(validatePack(JSON.stringify(doc.doc)).errors.filter(problem => /learned/.test(problem.message)), []);
    const why = to => { const d = openDoc({ doc: SMALL() }); return renameId(buildRefs(d), d, 'secret', 'wren/lamp', to).refusal; };
    assert.match(why('wren/'), /is not an id/);
    assert.match(why('wren/Bad Id'), /is not an id/);
    assert.match(why('tam/lamp'), /stays with its person/);
    assert.match(why('wren/lamp'), /same as the old one/);
    const d = openDoc({ doc: SMALL() });
    assert.match(renameId(buildRefs(d), d, 'secret', 'wren/none', 'wren/x').refusal, /no secret "wren\/none"/);
});
