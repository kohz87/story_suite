// The author spec's own examples (v0.13 §2, §3, §5, §7, §8), as written there, installed with a minimal supporting pack. They use display names
// where a name is unique (power and score names, realm and place names), so this catches a check that is stricter than the spec.
// Two spots are changed and marked SPEC-CONFLICT: the spec writes `roads-closed` at a route (§3 main example) and at a region (famine), which
// its own "one scope per condition" rule cannot both hold; and `at-war@the March` needs `the March` to be a realm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';

const cond = (name, scope, extra = {}) => ({ name, scope, fades: 'until cleared', means: `${name} holds.`, ...extra });
const support = {
    placeKinds: { capital: 'capital', town: 'town' }, routeKinds: { road: 'road' },
    realms: [{ id: 'highmark-empire', name: 'Highmark Empire', regions: ['highmark-core'] }, { id: 'the-march', name: 'the March', regions: ['march-region'] }, { id: 'the-marches', name: 'the Marches', regions: ['marches-region'] }],
    items: [{ name: 'Rye', tags: ['grain'] }, { name: 'Pike', tags: ['fish'] }],
    places: [{ id: 'highmark-capital', name: 'Highmark Capital', region: 'highmark-core', kind: 'capital', x: 0, y: 0 }, { id: 'ledgerford', name: 'Ledgerford', region: 'march-region', kind: 'town', x: 5, y: 5 }, { id: 'auvoth', name: 'Auvoth', region: 'marches-region', kind: 'town', x: 9, y: 9 }],
    routes: [{ name: 'Highmark-March road', from: 'Highmark Capital', to: 'Ledgerford', kind: 'road', km: 100 }],
    conditions: [
        cond('grain-dear', 'region', { fades: '1 season', means: 'Bread and fodder cost far more than usual; the poor go hungry.', effects: { prices: { grain: '×2', fish: '×1.3' }, routes: null } }),
        cond('crown-contested', 'realm'), cond('regent-named', 'realm'), cond('at-war', 'realm'), cond('garrisons-away', 'realm'), cond('granaries-open', 'realm'), cond('peace', 'realm'),
        cond('roads-closed', 'region'), // SPEC-CONFLICT: route in §3 main example, region in the famine example
        cond('unrest', 'place'), cond('coronation-festival', 'place'), cond('rebuilding', 'place'), cond('fallen', 'place', { placeStatus: true }),
        cond('harvest-failed', 'region'), cond('refugees', 'region'),
    ],
    powers: [{ id: 'princess-wendhild', name: 'Princess Wendhild', start: 30 }, { id: 'the-march-lords', name: 'the March lords', start: 10 }, { id: 'ashen-veil', name: 'Ashen Veil', start: 20 }],
    scores: [{ id: 'highmark-stability', name: 'Highmark Stability', start: 40 }, { id: 'famine-relief', name: 'Famine Relief', start: 0 }],
};

const cast = [
    { kind: 'companion', id: 'sir-lothar', name: 'Sir Lothar', aliases: ['the Grey Knight'], role: 'Marshal of the Highmark March', look: '…', wears: '…', voice: '…', history: '…', behaviour: ['Loyalty: high - keeps every oath', 'Honesty: medium - omits'], homeBase: 'Ledgerford',
        start: { place: 'Highmark Capital', goal: 'keep the march quiet', routine: 'drills the guard at dawn, sits in council by day' }, keyRelationships: [{ id: 'adalmar', text: 'served him for thirty years' }], ties: [{ with: 'adalmar', tag: 'serves' }],
        stages: [{ name: 'Wary', needs: [{ meter: 'trust', at: 0 }], text: 'He answers questions.' }, { name: 'Trusted', needs: [{ meter: 'trust', at: 40 }, { meter: 'tension', at: -20 }], text: 'He lets You see the ledgers.', milestone: 'lothar-sees-ledgers' }],
        secrets: [{ id: 'letter', gate: 'stage >= "Trusted" or fact:letter-found', text: '…' }], protected: true, canDieUnmet: false },
    { kind: 'figure', id: 'adalmar', name: 'Emperor Adalmar', aliases: ['the Old Emperor'], role: 'Emperor of Highmark', look: '…', homeBase: 'Highmark Capital', voice: '…', ties: [{ with: 'sir-lothar', tag: 'ally' }], keyRelationships: [{ id: 'sir-lothar', text: 'his oldest sword' }], status: 'dying', protected: true, canDieUnmet: false },
    { kind: 'figure', id: 'toll-keeper', name: 'The Toll-Keeper', role: 'keeps the Ledgerford bridge', ties: [], secrets: [] },
];

const events = [
    { id: 'succession-crisis', kind: 'one-off', certainty: 'likely', reach: 'realm', where: ['Highmark Empire'],
        requires: ['crown-contested@Highmark Empire', 'died:adalmar', 'score:highmark-stability <= 20'], window: { after: 'died:adalmar + 3 days', within: '40 days' }, chance: '70% over the window',
        likelier_if: { 'garrisons-away@Highmark Empire': '×2', 'unrest@Highmark Capital': '×1.5' }, less_if: { 'regent-named@Highmark Empire': '×0.5' }, pre_empted_by: ['fired:coronation'],
        outcomes: [
            { name: 'the regent holds', weight: 'power:Princess Wendhild', effects: { set: ['regent-named@Highmark Empire: until cleared'], powers: { 'Princess Wendhild': 5 } }, summary: 'Wendhild holds the throne in trust.' },
            { name: 'the lords split', weight: 'power:the March lords', effects: { set: ['at-war@the March: 1 season'], scores: { 'Highmark Stability': -10 } }, summary: 'The March lords refuse the regent.' }],
        effects: { set: ['roads-closed@march-region: 20 days', 'unrest@Highmark Capital: 30 days'], // SPEC-CONFLICT: the spec writes roads-closed@Highmark-March road
            cast: [{ who: 'sir-lothar', location: 'Highmark Capital', status: 'summoned to the regent', until: 'end', routine: 'attends the regent at court' }],
            facts: [{ id: 'regency-declared', text: 'A regency was declared in Highmark.' }], on_end: { clear: ['unrest@Highmark Capital'] } },
        ends_when: { for: '40 days', any_of: ['fired:coronation'] }, summary: 'The succession crisis in Highmark: {outcome}.' },
    { id: 'diet-of-ledgerford', kind: 'chain-stage', certainty: 'likely', reach: 'realm', where: ['Highmark Empire'], requires: ['stage:succession-crisis'], window: { after: 'fired:succession-crisis', within: '60 days' }, ends_when: { for: '10 days' }, summary: 'The lords meet at Ledgerford.' },
    { id: 'coronation', kind: 'chain-stage', certainty: 'set-in-motion', reach: 'world', where: ['Highmark Empire'], requires: ['crown-contested@Highmark Empire'], requires_any: ['stage:diet-of-ledgerford', 'fired:succession-crisis + 90 days'],
        window: { after: 'fired:succession-crisis', within: '150 days' }, likelier_if: { 'regent-named@Highmark Empire': '×2' },
        effects: { set: ['coronation-festival@Highmark Capital: 10 days'], facts: [{ id: 'new-emperor-crowned', text: 'A new ruler of Highmark was crowned.' }],
            on_end: { clear: ['crown-contested@Highmark Empire', 'regent-named@Highmark Empire'], scores: { 'Highmark Stability': 15 } } }, ends_when: { for: '3 days' }, summary: 'Highmark crowns a successor to Emperor Adalmar.' },
    { id: 'famine', kind: 'recurring', certainty: 'possible', reach: 'regional', where: 'where conditions fit', requires: ['harvest-failed@region'], chance: '30% per season', cooldown: '1 season per place',
        likelier_if: { 'roads-closed@region': '×2', 'at-war@realm': '×1.5' }, less_if: { 'granaries-open@realm': '×0.5' },
        effects: { set: ['grain-dear@region: 1 season', 'refugees@region: 20 days'], scores: { 'Famine Relief': -5 }, on_end: { clear: ['harvest-failed@region'] } }, ends_when: { for: '30 days' }, summary: 'Famine grips {region}.' },
    { id: 'war-of-faiths', kind: 'one-off', certainty: 'likely', reach: 'world', where: ['the Marches'], requires: ['crown-contested@Highmark Empire', 'power:ashen-veil >= 40'], window: { after: 'start', within: '120 days' }, chance: '50% over the window',
        effects: { set: ['at-war@the Marches: until cleared'] }, ends_when: { for: '60 days', any_of: ['power:ashen-veil <= 10', 'fired:peace-of-ledgerford'] }, summary: 'The War of Faiths breaks out.' },
    { id: 'peace-of-ledgerford', kind: 'one-off', certainty: 'possible', reach: 'world', where: ['the Marches'], ends_when: 'instant', summary: 'Peace.' },
];

const templates = [
    { template: 'bread-riot', scope: 'place', severity: 'minor', reach: 'local', needs: ['grain-dear@region'], sets: ['unrest@place: 10 days'], cooldown: '1 season per place', summary: 'Bread riots in {place}.' },
    { template: 'reconstruction', scope: 'place', severity: 'major', reach: 'regional', needs: ['fallen@place', 'peace@realm'], sets: ['rebuilding@place: 1 season'], clears: ['fallen@place'], cooldown: '1 year per place', summary: '{place} is rebuilt and resettled.' },
];

const lore = [
    { title: 'The Reopening', keys: ['Reopening', 'Wildzone', 'Restorationists'], text: '…', protected: true },
    { title: 'What the Vault Holds', keys: ['vault', 'Ledgerford vault'], secondaryKeys: ['seal', 'key'], logic: 'and any', text: '…', hidden: true, gate: 'fact:vault-opened or meter trust >= 40 of sir-lothar' },
    { title: 'Tone of the Marches', keys: ['Marches'], constant: true, order: 10, text: '…' },
];

const install = content => validatePack(JSON.stringify({ id: 'spec-examples', version: '1.0.0', format: 3, requires: { storyBlock: '0.1.0' }, content }));

test('the spec examples install as written (names where unique, ids in thresholds)', () => {
    const result = install({ ...support, cast, worldEvents: events, templates, lore });
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 1));
    assert.equal(result.pack.content.worldEvents.length, events.length);
    assert.equal(result.pack.content.cast.length, 3);
    const unexpected = (result.warnings ?? []).filter(warning => !/vault-opened|letter-found/.test(warning.message));
    assert.deepEqual(unexpected, [], 'only the two facts nothing writes are said');
});

test('the lore gate is read in the spec\'s own order ("meter trust >= 40 of sir-lothar") and in the written order', () => {
    const written = structuredClone(lore);
    written[1].gate = 'fact:vault-opened or meter trust of sir-lothar >= 40';
    assert.equal(install({ ...support, cast, worldEvents: events, templates, lore: written }).ok, true);
});
