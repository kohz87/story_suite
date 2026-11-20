// PORTLINK: a dossier made before its cast person was met (a "+ npc" line, a scan) had no castFrom, so the pack's picture never came.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord } from '../../modules/people/core/core.js';
import { castLinkTargets, castPortraitWanted, linkToCast, normalizeCast } from '../../modules/people/dossier/cast-dossier.js';
import { TEMIWA_ENTRY, person, unmet } from './cast-dossier.helpers.js';

const met = (extra = {}) => normalizeCast([person({ name: 'Sister Temiwa', aliases: ['Temiwa', 'Last Candle'], key: 'ersveil:temiwa', id: 'temiwa', entry: { ...structuredClone(TEMIWA_ENTRY), name: 'Sister Temiwa', aliases: ['Temiwa', 'Last Candle'] }, ...extra })]);
let serial = 0;
const record = (name, extra = {}) => ({ ...createNpcRecord(name, Array.from({ length: serial++ }, (_, at) => `npc_x${at}`)), ...extra });

test('a dossier made from a + npc line is linked by its name, a short alias or a title alias; a name that is neither is left alone', () => {
    const people = met();
    for (const name of ['Sister Temiwa', 'Temiwa', 'Last Candle', 'sister temiwa']) {
        const got = castLinkTargets([record(name)], people);
        assert.equal(got.length, 1, name);
        assert.equal(got[0].person.key, 'ersveil:temiwa');
    }
    assert.equal(castLinkTargets([record('Temiwa the healer')], people).length, 0, 'not her name or an alias: no guess');
});

test('linking adds castFrom only: the story\'s own words stay, the pack picture may then follow, a picture of its own is kept', () => {
    const own = record('Temiwa', { role: 'the narrator\'s role', personality: 'Narrator words.' });
    const [{ npc, person: who }] = castLinkTargets([own], met());
    const linked = linkToCast(npc, who, { packName: 'Ersveil' });
    assert.equal(linked.castFrom.key, 'ersveil:temiwa');
    assert.equal(linked.role, own.role);
    assert.equal(linked.personality, own.personality);
    assert.equal(linked.name, 'Temiwa');
    assert.equal(linked.castFrom.first.personality, undefined, 'the pack words are not marked as the dossier\'s own words');
    assert.equal(castPortraitWanted(linked), true, 'no portrait of its own: the pack picture may come');
    assert.equal(castPortraitWanted({ ...linked, portrait: { dataUrl: 'data:image/png;base64,AAAA', mime: 'image/png' } }), false);
});

test('no link without exactly one dossier and one person, for a linked, archived or removed one, or an unmet person', () => {
    const people = met();
    assert.equal(castLinkTargets([record('Temiwa'), record('Last Candle')], people).length, 0, 'two dossiers fit her');
    assert.equal(castLinkTargets([record('Temiwa', { castFrom: { key: 'ersveil:temiwa' } })], people).length, 0, 'already linked');
    assert.equal(castLinkTargets([record('Temiwa'), record('X', { castFrom: { key: 'ersveil:temiwa' } })], people).length, 0, 'her key is already taken');
    assert.equal(castLinkTargets([record('Temiwa', { archived: true })], people).length, 0);
    assert.equal(castLinkTargets([record('Temiwa')], people, () => true).length, 0, 'the reader removed her');
    assert.equal(castLinkTargets([record('Temiwa')], normalizeCast([unmet()])).length, 0, 'not met');
    const twins = normalizeCast([person({ name: 'Temiwa', key: 'p:a', id: 'a' }), person({ name: 'Temiwa', key: 'p:b', id: 'b' })]);
    assert.equal(castLinkTargets([record('Temiwa')], twins).length, 0, 'two people fit it');
});
