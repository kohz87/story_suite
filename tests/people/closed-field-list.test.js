// The people store's closed field list against what NPC State really writes: a birthday rollover's apparent-age anchor, the alias spellings an import may hold,
// and every key the field table names must make a view the store accepts (a stray key would make every later people write of the chat INVALID).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeScanResult, normalizeNpcRecord, setActiveCalendarConfig, setStoryClockSource } from '../../packages/npc-state-delta/core.js';
import { FIELDS } from '../../packages/npc-state-delta/src/fields/registry.js';
import { peopleView } from '../../packages/npc-state-delta/src/people/view.js';
import { PERSON_FIELDS } from '../../packages/story-block/src/v2/domains/people/person-fields.js';
import { validatePeople } from '../../packages/story-block/src/v2/domains/people/validate.js';

const CALENDAR = Object.freeze({ era: 'CR', months: [{ name: 'Redleaf', days: 30 }, { name: 'Sunwane', days: 31 }, { name: 'Frostwane', days: 30 }] });
test.afterEach(() => { setStoryClockSource(null); setActiveCalendarConfig(null); });

const accepted = records => validatePeople(peopleView({ turn: 1, npcs: records, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} }));

test('a record after a birthday rollover with an apparent age is accepted by the store (the anchor is a person field)', () => {
    setActiveCalendarConfig(CALENDAR);
    const existing = normalizeNpcRecord({ id: 'npc_sora', name: 'Sora', age: '6', apparentAge: '~6', birthDate: { month: 'Redleaf', day: 16 }, birthDateSource: 'established' });
    const empty = { turn: 1, npcs: [existing], candidates: [], socialGraph: { version: 1, edges: [], unresolved: [] } };
    const scan = { npcs: [{ id: 'npc_sora', name: 'Sora' }] };
    const first = mergeScanResult(empty, scan, { sourceMessageId: 12, developmentContext: '<World_State>Time | **CR821, Redleaf 16** | 7:42 pm</World_State>' });
    const second = mergeScanResult(first.state, scan, { sourceMessageId: 13, developmentContext: '<World_State>Time | CR822, Redleaf 16 | evening</World_State>' });
    const sora = second.state.npcs.find(npc => npc.id === 'npc_sora');
    assert.equal(sora.apparentAge, '~7');
    assert.ok(sora.apparentAgeAnchor, 'the rollover wrote the anchor');
    assert.deepEqual(accepted(second.state.npcs), []);
});

test('alias spellings in an imported record are read and then dropped, so the view is accepted', () => {
    const imported = normalizeNpcRecord({
        id: 'npc_lio', name: 'Lio', sex: 'male', race: 'elf', home_base: 'the dock', identity_kind: 'person', is_minor: false,
        key_relationships: [], behavior_profile: ['calm'], profile_evidence: {}, relationship_progress: {},
    });
    assert.equal(imported.gender, 'male');
    assert.equal(imported.species, 'elf');
    assert.equal(imported.homeBase, 'the dock');
    assert.deepEqual(Object.keys(imported).filter(key => !PERSON_FIELDS.has(key)), []);
    assert.deepEqual(accepted([imported]), []);
});

test('every field the table, its lock groups and its revert groups name is a person field (lookLockedAt belongs to the bond meters, not a dossier)', () => {
    const named = new Set();
    for (const [key, field] of Object.entries(FIELDS)) {
        named.add(key);
        for (const group of [field.lock?.[1], field.revertGroup?.[1]]) for (const name of Array.isArray(group) ? group : []) named.add(name);
    }
    named.delete('lookLockedAt');
    assert.deepEqual([...named].filter(key => !PERSON_FIELDS.has(key)).sort(), []);
});
