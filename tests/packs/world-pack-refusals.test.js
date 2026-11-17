// Every refusal rule of the world pack's install check: change one thing in the sample, expect that rule's Problem (and no other failure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, sample } from './helpers/world-pack-sample.js';

const clone = value => JSON.parse(JSON.stringify(value));
const event = (world, id) => world.content.worldEvents.find(each => each.id === id);
const person = (world, id) => world.content.cast.find(each => each.id === id);
const errorsOf = change => { const world = clone(sample); change(world); const result = check(world); return result.ok ? [] : result.errors.map(error => error.message); };
const warningsOf = change => { const world = clone(sample); change(world); const result = check(world); assert.equal(result.ok, true, JSON.stringify(result.errors)); return (result.warnings ?? []).map(warning => warning.message); };

function refuses(table) {
    for (const [name, change, pattern] of table) {
        test(`refused: ${name}`, () => {
            const problems = errorsOf(change);
            assert.ok(problems.some(message => pattern.test(message)), `${pattern} not in ${JSON.stringify(problems)}`);
        });
    }
}

refuses([
    ['a place kind neither mapped nor an engine class', w => { w.content.places[1].kind = 'hamlet'; }, /"hamlet" is not in placeKinds and is not an engine class/],
    ['a route kind neither mapped nor an engine class', w => { w.content.routes[2].kind = 'cart track'; }, /"cart track" is not in routeKinds/],
    ['a kind mapped to a class that does not exist', w => { w.content.placeKinds.fort = 'castle'; }, /"fort" maps to "castle", which is not an engine class/],
    ['a place name with "@"', w => { w.content.places[2].name = 'North@ledger'; }, /may not contain "@" or ": "/],
    ['a region with ": "', w => { w.content.places[2].region = 'River: core'; w.content.realms[0].regions.push('River: core'); }, /may not contain "@" or ": "/],
    ['a realm name with ": "', w => { w.content.realms[0].name = 'River Confederacy: Bluewatch'; }, /may not contain "@" or ": "/],
    ['a route name with "@"', w => { w.content.routes[0].name = 'Ledger@river'; }, /may not contain "@" or ": "/],
    ['one id for a realm and a place', w => { w.content.realms[0].id = 'ledgerford'; }, /names a realm and a place/],
    ['one id for a region and a place', w => { w.content.places[1].id = 'the-marches'; }, /names a region and a place/],
    ['a region in two realms', w => { w.content.realms.push({ id: 'other', name: 'Other', regions: ['the-marches'] }); }, /already in realm/],
    ['a power with a bad start', w => { w.content.powers[0].start = 500; }, /start must be a whole number/],
    ['a power holding a place the pack lacks', w => { w.content.powers[0].holds = ['Nowhere']; }, /not a place of this pack/],
    ['a score start outside its range', w => { w.content.scores[0].range = [0, 20]; }, /start must be a whole number inside the range/],
    ['a threshold naming a power with no such id', w => { event(w, 'war-of-faiths').requires[1] = 'power:nobody >= 40'; }, /no power with the id "nobody"/],
    ['a threshold number outside the range', w => { event(w, 'war-of-faiths').requires[1] = 'power:ashen-veil >= 140'; }, /outside the range/],
    ['a threshold written with a display name', w => { event(w, 'war-of-faiths').requires[1] = 'power:Ashen Veil >= 40'; }, /id .*not its display name/],
    ['a threshold with ">"', w => { event(w, 'war-of-faiths').requires[1] = 'power:ashen-veil > 40'; }, /only >= and <= exist/],
    ['a threshold in pre_empted_by (likelier_if and less_if take one, spec v0.14.2)', w => { event(w, 'succession-crisis').pre_empted_by.push('power:ashen-veil >= 40'); }, /threshold is not allowed here/],
    ['a threshold in pre_empted_by', w => { event(w, 'succession-crisis').pre_empted_by.push('score:highmark-stability <= 5'); }, /threshold is not allowed here/],
    ['a negative outcome weight', w => { event(w, 'succession-crisis').outcomes[0].weight = -1; }, /must be 0 or more/],
    ['an outcome weight naming a power that does not exist', w => { event(w, 'succession-crisis').outcomes[0].weight = 'power:Nobody'; }, /no power with that id/],
    ['an effect on an ambiguous power name', w => { w.content.powers.push({ id: 'twin', name: 'Ashen Veil', start: 0 }); event(w, 'succession-crisis').effects.powers = { 'Ashen Veil': 5 }; }, /not the id, or a unique name/],
    ['an event without ends_when', w => { delete event(w, 'famine').ends_when; }, /every event needs ends_when/],
    ['ends_when as a sentence', w => { event(w, 'famine').ends_when = 'after thirty days'; }, /not a sentence/],
    ['an unknown event field', w => { event(w, 'famine').deadline = true; }, /"deadline" is not an event field/],
    ['an anchor naming a legacy event id', w => { w.content.events = [{ id: 'old-cue', when: 'true', cue: 'x' }]; event(w, 'succession-crisis').pre_empted_by = ['fired:old-cue']; }, /legacy dated event/],
    ['an anchor naming no event', w => { event(w, 'succession-crisis').pre_empted_by = ['fired:nothing']; }, /not an event in content\.worldEvents/],
    ['a chain stage that requires no stage', w => { event(w, 'diet-of-ledgerford').requires = ['crown-contested@Highmark Empire']; }, /requires "stage:<previous event id>"/],
    ['a recurring event with no cooldown', w => { delete event(w, 'famine').cooldown; }, /needs a cooldown/],
    ['a recurring event with a window', w => { event(w, 'famine').window = { within: '10 days' }; }, /has no window/],
    ['a placeholder in a one-off', w => { event(w, 'succession-crisis').requires.push('unrest@place'); }, /binds to the place picked for a recurring event/],
    ['a placeholder of the wrong scope', w => { event(w, 'famine').requires = ['harvest-failed@place']; }, /is a place, but "harvest-failed" is a region-scope/],
    ['a condition the pack does not declare', w => { event(w, 'famine').effects.set = ['plague@region: 5 days']; }, /not a condition this pack declares/],
    ['a ref that names nothing', w => { event(w, 'succession-crisis').requires[0] = 'crown-contested@Atlantis'; }, /not a place, route, region or realm/],
    ['a ref of the wrong scope', w => { event(w, 'succession-crisis').requires[0] = 'crown-contested@Ledgerford'; }, /is a place, but "crown-contested" is a realm-scope/],
    ['a died: anchor with no cast entry', w => { event(w, 'succession-crisis').requires[1] = 'died:ghost'; }, /not a cast id/],
    ['effects.cast.who with no cast entry', w => { event(w, 'succession-crisis').effects.cast[0].who = 'ghost'; }, /not a cast id/],
    ['a percentage modifier', w => { event(w, 'succession-crisis').less_if['regent-named@Highmark Empire'] = '50%'; }, /write ×N/],
    ['where kinds that are unmapped', w => { event(w, 'dungeon-break').where.kinds = ['tower']; }, /not in placeKinds/],
    ['"where conditions fit" on a one-off', w => { event(w, 'succession-crisis').where = 'where conditions fit'; }, /is for a recurring event/],
    ['a "per season" chance on a one-off', w => { event(w, 'succession-crisis').chance = '30% per season'; }, /for a recurring event/],
    ['a duplicate event id', w => { w.content.worldEvents.push(clone(event(w, 'famine'))); }, /share the id "famine"/],
    ['an event id that is also a legacy id', w => { w.content.events = [{ id: 'famine', when: 'true', cue: 'x' }]; }, /unique across both lists/],
    ['a template with cast effects', w => { w.content.templates[0].effects = { cast: [] }; }, /no effects: it sets and clears conditions only|no effects/],
    ['a template setting a place status where a protected person lives', w => { w.content.templates[0].sets = ['fallen@Highmark Capital: 10 days']; }, /protected person "adalmar" lives/],
    ['a price multiplier of zero', w => { w.content.conditions[0].effects.prices.grain = '×0'; }, /N above 0/],
    ['a price on a category nothing declares', w => { w.content.conditions[0].effects.prices.silk = '×2'; }, /no declared goods category/],
    ['a bad route effect', w => { w.content.conditions[6].effects.routes = 'closed'; }, /routes must be "blocked"/],
    ['hidden lore with no gate', w => { delete w.content.lore[1].gate; }, /hidden entry must have a gate/],
    ['lore logic outside the four', w => { w.content.lore[1].logic = 'maybe'; }, /logic must be one of/],
    ['two lore entries with one title', w => { w.content.lore[2].title = 'The Reopening'; }, /titles are unique/],
    ['a lore gate naming a stage the person lacks', w => { w.content.lore[1].gate = 'stage of sir-lothar >= "Beloved"'; }, /no stage named "Beloved"/],
    ['a lore gate with a stage test and no person', w => { w.content.lore[1].gate = 'stage >= "Wary"'; }, /names the person/],
    ['a lore gate with an unknown place', w => { w.content.lore[1].gate = 'place:Atlantis'; }, /not a place of this pack/],
]);

// A person nothing points at, written fully, so each rule can break her alone.
const extra = world => { const copy = clone(person(world, 'sir-lothar')); Object.assign(copy, { id: 'extra', name: 'Extra Knight', aliases: [] }); world.content.cast.push(copy); return copy; };

test('B7: one bad cast entry is refused alone: the rest load, and the Problem names the person and the field', () => {
    const world = clone(sample);
    extra(world).behaviour = ['Honesty: mid - fudges'];
    const result = check(world);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.cast.map(each => each.id), ['adalmar', 'sir-lothar', 'toll-keeper']);
    assert.match(result.warnings.map(warning => `${warning.path} ${warning.message}`).join('\n'), /content\.cast\[3\]\.behaviour\[0\] Cast "Extra Knight" was refused, the rest of the cast still loads: .*not "mid"/);
});

test('a refused person who is written: references to them are dropped with a Problem, the referrers stay, the pack installs', () => {
    const world = clone(sample);
    person(world, 'sir-lothar').behaviour = ['Honesty: mid - fudges'];
    const result = check(world);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.cast.map(each => each.id), ['adalmar', 'toll-keeper']);
    const adalmar = result.pack.content.cast[0];
    assert.deepEqual([adalmar.ties, adalmar.keyRelationships], [[], []], 'Adalmar stays, without the references to Lothar');
    const text = result.warnings.map(warning => warning.message).join('\n');
    assert.match(text, /Cast "Sir Lothar" was refused/);
    assert.match(text, /Emperor Adalmar": ties\[0\] names "sir-lothar", who was refused/);
    assert.match(text, /"sir-lothar" was refused \(see the cast Problems\); the step skips this entry/);
});

test('spec §6: a unique display name or alias is allowed for a power in a weight and in effects; thresholds take ids only', () => {
    assert.equal(check((() => { const w = clone(sample); event(w, 'succession-crisis').outcomes[0].weight = 'power:Princess Wendhild'; event(w, 'succession-crisis').effects.powers = { 'the Veil': 5 }; return w; })()).ok, true);
});

test('a gate on lore that is not hidden is a warning', () => {
    assert.ok(warningsOf(w => { w.content.lore[0].gate = 'fact:x'; }).some(message => /gate belongs on a hidden entry/.test(message)));
});

test('cast entries: a bad one is refused for each rule, the others stay', () => {
    const rules = [
        ['seven aliases', p => { p.aliases = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; }, /aliases must be a list of at most 6/],
        ['a start written as a string', p => { p.start = 'Ledgerford'; }, /start must be \{/],
        ['a missing kind', p => { delete p.kind; }, /kind must be "companion" or "figure"/],
        ['a tie tag outside the nine', p => { p.ties[0].tag = 'lover'; }, /tag must be one of/],
        ['a secret mixing the spec and old fields', p => { p.secrets[0].meter = 'trust'; }, /mixes the spec fields/],
        ['a secret gate naming a stage the person lacks', p => { p.secrets[0].gate = 'stage >= "Beloved"'; }, /no stage named "Beloved"/],
        ['a stage naming a meter the person lacks', p => { p.stages[0].needs[0].meter = 'devotion'; }, /not one of this person's meters/],
        ['two stages of one name', p => { p.stages[1].name = 'Wary'; }, /two stages are named "Wary"/],
        ['a stage written with a bare threshold', p => { p.stages[0] = { name: 'Wary', at: 0, text: 'x' }; }, /"at" is not a field here/],
        ['a level out of range', p => { p.level = 120; }, /level must be a whole number from 1 to 99/],
        ['a tie to a person with no entry', p => { p.ties.push({ with: 'ghost', tag: 'ally' }); }, /"ghost" is not a cast id/],
    ];
    for (const [name, change, pattern] of rules) {
        const world = clone(sample);
        change(extra(world));
        const result = check(world);
        assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.errors)}`);
        assert.ok(result.warnings.some(warning => pattern.test(warning.message) && /Extra Knight/.test(warning.message)), `${name}: ${JSON.stringify(result.warnings)}`);
        assert.deepEqual(result.pack.content.cast.map(each => each.id), ['adalmar', 'sir-lothar', 'toll-keeper'], `${name}: the rest still load and the bad one is left out`);
    }
});

test('a figure needs only id, name and kind, and may carry every companion field', () => {
    const world = clone(sample);
    world.content.cast.push({ kind: 'figure', id: 'bare', name: 'Bare' }, { kind: 'figure', id: 'rich', name: 'Rich', voice: 'Soft.', abilities: [{ name: 'Lore', description: 'Knows much.' }], meters: { trust: 5 } });
    const result = check(world);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.cast.slice(-2).map(each => each.id), ['bare', 'rich']);
});

test('warnings, not refusals: a fact nothing writes, a place status with no way to clear it, a power also in ripples.powers', () => {
    assert.ok(warningsOf(w => { event(w, 'succession-crisis').requires.push('fact:never-written'); }).some(message => /"never-written".*no event, outcome or template/.test(message)));
    const noClear = warningsOf(w => { w.content.templates = w.content.templates.slice(0, 1); event(w, 'war-of-faiths').effects.set = ['unrest@Veil Cellar: 5 days']; });
    assert.ok(noClear.some(message => /"fallen" is a place status that lasts until cleared/.test(message)));
    assert.equal(warningsOf(() => {}).some(message => /"fallen" is a place status/.test(message)), false, 'the reconstruction template is its clearing path');
    const ripples = warningsOf(w => { w.ripples = { powers: [{ id: 'veil', name: 'Ashen Veil', base: 20 }] }; });
    assert.ok(ripples.some(message => /also in ripples\.powers/.test(message)));
});

test('a season anchor the calendar cannot resolve is a warning; the built-in quarters are known', () => {
    assert.ok(warningsOf(w => { event(w, 'war-of-faiths').window.after = 'harvestmoon'; }).some(message => /"harvestmoon" is not a season/.test(message)));
    assert.equal(warningsOf(w => { event(w, 'war-of-faiths').window.after = 'spring'; }).some(message => /not a season/.test(message)), false);
});
