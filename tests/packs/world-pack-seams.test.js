// The install check for the v0.14.4-v0.14.9 seams: learned: anchors and writes_fact (ruling 32, acceptance tests 102-103), from on cast
// effects and deaths and even_in_party (rulings 34-35, 40), the warning on a named move without from (ruling 38, acceptance test 120).
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, sample } from './helpers/world-pack-sample.js';

const clone = value => JSON.parse(JSON.stringify(value));
const errorsOf = result => (result.errors ?? []).map(error => error.message).join('\n');
const warningsOf = result => (result.warnings ?? []).map(warning => warning.message).join('\n');

/** The sample with Sir Lothar's secret `letter` writing a fact, a hidden lore entry with an id, and one event changed by `edit`. */
function variant(edit = () => {}) {
    const pack = clone(sample);
    pack.content.cast[1].secrets = [{ id: 'letter', gate: 'stage >= "Trusted" or fact:letter-found', text: 'He burned the letter.', writes_fact: 'binding-exposed' }];
    pack.content.lore[1] = { ...pack.content.lore[1], id: 'vault', writes_fact: 'binding-exposed' };
    edit(pack.content);
    return check(pack);
}
const event = (content, id) => content.worldEvents.find(entry => entry.id === id);

test('test 103: learned: anchors name a known cast secret or hidden lore entry; unknown ids and display names are refused', () => {
    const ok = variant(content => {
        const war = event(content, 'war-of-faiths');
        war.requires_any = ['learned:sir-lothar/letter', 'learned:lore/vault'];
        war.pre_empted_by = ['learned:sir-lothar/letter'];
        war.likelier_if = { 'learned:lore/vault': '×2' };
        war.ends_when.any_of.push('learned:sir-lothar/letter');
    });
    assert.equal(ok.ok, true, errorsOf(ok));
    for (const [anchor, said] of [
        ['learned:sir-lothar/missing', /sir-lothar has no secret with the id "missing"/],
        ['learned:nobody/page', /"nobody" is not a cast id/],
        ['learned:lore/missing', /"missing" is not the id of a lore entry/],
        ['learned:Sir Lothar/The Letter', /"Sir Lothar" is not a cast id/],
        ['learned:lore/', /learned:<cast id>\/<secret id>/],
    ]) {
        const bad = variant(content => { event(content, 'war-of-faiths').requires = [anchor]; });
        assert.equal(bad.ok, false, anchor);
        assert.match(errorsOf(bad), said, anchor);
    }
    const shown = variant(content => { content.lore[0].id = 'reopening'; event(content, 'war-of-faiths').requires = ['learned:lore/reopening']; });
    assert.match(errorsOf(shown), /"reopening" is not hidden/, 'only a hidden entry is learned');
});

test('test 102 (install side): a fact only writes_fact writes raises no warning; writes_fact on an old secret or an open lore entry is refused', () => {
    const ok = variant(content => { event(content, 'war-of-faiths').requires = ['fact:binding-exposed']; });
    assert.equal(ok.ok, true, errorsOf(ok));
    assert.doesNotMatch(warningsOf(ok), /binding-exposed/, 'written by the pack (writes_fact)');
    // A cast entry's mistake refuses that one entry (B7: the rest of the cast loads), as a Problem.
    const old = variant(content => { content.cast[2].secrets = [{ title: 'Old', text: 'Old secret.', meter: 'trust', at: 40, writes_fact: 'x' }]; });
    assert.match(`${errorsOf(old)}\n${warningsOf(old)}`, /"writes_fact" is not a secret field here/);
    assert.ok(!old.pack?.content.cast.some(person => person.id === 'toll-keeper'), 'that person is refused');
    const open = variant(content => { content.lore[0].writes_fact = 'x'; });
    assert.match(errorsOf(open), /writes_fact belongs on a hidden entry/);
    const gate = variant(content => { content.lore[1].gate = 'fact:vault-opened or learned:sir-lothar/letter'; });
    assert.equal(gate.ok, true, `a gate joins a learned: term: ${errorsOf(gate)}`);
});

test('from and even_in_party: a place id or "anywhere" on a move or a death; anything else is refused', () => {
    const ok = variant(content => {
        const crisis = event(content, 'succession-crisis');
        crisis.even_in_party = true;
        crisis.effects.cast = [{ who: 'sir-lothar', from: 'highmark-capital', location: 'Ledgerford' }, { who: 'adalmar', died: true, from: 'anywhere' }, { who: 'toll-keeper', died: true, from: 'ledgerford' }];
    });
    assert.equal(ok.ok, true, errorsOf(ok));
    const bad = variant(content => { event(content, 'succession-crisis').effects.cast = [{ who: 'sir-lothar', from: 'Atlantis', location: 'Ledgerford' }]; });
    assert.match(errorsOf(bad), /"Atlantis" is not a place of this pack \(from is a place id or "anywhere"\)/);
    const flag = variant(content => { event(content, 'succession-crisis').even_in_party = 'yes'; });
    assert.match(errorsOf(flag), /even_in_party must be true or false/);
});

test('test 120: a named move without from for someone whose start is not where the event happens warns (the pack loads); with from, or at the start, none', () => {
    const away = ['coronation', { who: 'sir-lothar', location: 'Ledgerford' }];
    const where = (content, id, list) => { event(content, id).where = list; };
    const warned = variant(content => { where(content, 'coronation', ['ledgerford']); event(content, 'coronation').effects.cast = [away[1]]; });
    assert.equal(warned.ok, true, errorsOf(warned));
    assert.match(warningsOf(warned), /coronation\.effects\.cast: the move of "sir-lothar" has no from and their start \(Highmark Capital\) is not where the event happens/);
    for (const [label, edit] of [
        ['with a place from', content => { where(content, 'coronation', ['ledgerford']); event(content, 'coronation').effects.cast = [{ ...away[1], from: 'highmark-capital' }]; }],
        ['with from anywhere', content => { where(content, 'coronation', ['ledgerford']); event(content, 'coronation').effects.cast = [{ ...away[1], from: 'anywhere' }]; }],
        ['at the start place', content => { where(content, 'coronation', ['highmark-capital']); event(content, 'coronation').effects.cast = [away[1]]; }],
    ]) assert.doesNotMatch(warningsOf(variant(edit)), /has no from/, label);
});

test('final review L3: a major with a kinds where and no region or realm warns (the pack loads); with a realm or region, or minor, none', () => {
    const kinds = (extra = {}, severity = 'major') => variant(content => { const crisis = event(content, 'succession-crisis'); crisis.severity = severity; crisis.where = { kinds: ['town'], ...extra }; });
    const warned = kinds();
    assert.equal(warned.ok, true, errorsOf(warned));
    assert.match(warningsOf(warned), /succession-crisis\.where: a major event with a kinds "where" and no region or realm counts against the major-event caps of every realm that has such a place/);
    const realm = sample.content.realms[0].id;
    for (const [label, result] of [['realm', kinds({ realm })], ['minor', kinds({}, 'minor')]]) {
        assert.equal(result.ok, true, `${label}: ${errorsOf(result)}`);
        assert.doesNotMatch(warningsOf(result), /kinds "where" and no region or realm/, label);
    }
    assert.doesNotMatch(warningsOf(variant()), /kinds "where" and no region or realm/, 'the sample as it is');
});
