// The sample world pack the install-check tests use: every spec part once (spec v0.13), small, installing with no errors.
import { validatePack } from '../../../packs/validate.js';
export const sample = {
  id: 'ersveil-world', version: '1.0.0', format: 3, name: 'Ersveil World',
  requires: { storyBlock: '^0.1' },
  content: {
    placeKinds: { fort: 'outpost', 'lock town': 'town', district: 'site', sea: 'none', capital: 'capital', town: 'town', dungeon: 'none' },
    routeKinds: { 'bastion road': 'relay-road', 'sea lane': 'sea', road: 'road', river: 'river', 'mountain road': 'pass' },
    regions: [{ id: 'the-marches', name: 'The Marches', aliases: ['the March'] }, { id: 'highmark-core', name: 'Highmark Core' }],
    realms: [{ id: 'highmark-empire', name: 'Highmark Empire', regions: ['the-marches', 'highmark-core'] }],
    items: [{ name: 'Rye bread', tags: ['grain'] }],
    places: [
      { id: 'highmark-capital', name: 'Highmark Capital', region: 'highmark-core', kind: 'capital', x: 0, y: 0, aliases: ['the Capital'] },
      { id: 'ledgerford', name: 'Ledgerford', region: 'the-marches', kind: 'lock town', x: 10, y: 5 },
      { id: 'northledger-depot', name: 'Northledger Depot', region: 'the-marches', kind: 'fort', x: 12, y: 9 },
      { id: 'veil-cellar', name: 'Veil Cellar', region: 'the-marches', kind: 'dungeon', x: 14, y: 9, weight: 2 },
      { id: 'tidehaven', name: 'Tidehaven', region: 'highmark-core', kind: 'town', x: -8, y: 3 },
    ],
    routes: [
      { name: 'Ledger river', from: 'Ledgerford', to: 'Northledger Depot', kind: 'river', km: 40 },
      { name: 'Ledger bastion road', from: 'Ledgerford', to: 'Northledger Depot', kind: 'bastion road', km: 38 },
      { from: 'Highmark Capital', to: 'Ledgerford', kind: 'road', km: 120 },
      { name: 'Tide lane', from: 'Highmark Capital', to: 'Tidehaven', kind: 'sea lane', km: 150, hours: 20 },
    ],
    conditions: [
      { name: 'grain-dear', scope: 'region', fades: '1 season', means: 'Bread and fodder cost far more.', effects: { prices: { grain: '×2', all: '×1.3' }, routes: null } },
      { name: 'crown-contested', scope: 'realm', fades: 'until cleared', means: 'Two claimants hold the crown.' },
      { name: 'regent-named', scope: 'realm', fades: 'until cleared', means: 'A regent rules in trust.' },
      { name: 'unrest', scope: 'place', fades: '30 days', means: 'Crowds in the streets.' },
      { name: 'fallen', scope: 'place', fades: 'until cleared', means: 'The place has fallen.', placeStatus: true },
      { name: 'harvest-failed', scope: 'region', fades: '1 season', means: 'The harvest failed.' },
      { name: 'roads-closed', scope: 'route', fades: '20 days', means: 'The road is shut.', effects: { routes: 'blocked' } },
    ],
    powers: [{ id: 'ashen-veil', name: 'Ashen Veil', aliases: ['the Veil'], start: 20, holds: ['Veil Cellar'] }, { id: 'princess-wendhild', name: 'Princess Wendhild', start: 10 }],
    scores: [{ id: 'highmark-stability', name: 'Highmark Stability', start: 30, means: 'How steady the crown is.' }, { id: 'tide-pressure', name: 'Tide Pressure', start: 0, drift: false }],
    cast: [
      { kind: 'figure', id: 'adalmar', name: 'Emperor Adalmar', aliases: ['the Old Emperor'], role: 'Emperor of Highmark', homeBase: 'Highmark Capital', ties: [{ with: 'sir-lothar', tag: 'ally' }], keyRelationships: [{ id: 'sir-lothar', text: 'his oldest sword' }], status: 'dying', protected: true, canDieUnmet: false },
      { kind: 'companion', id: 'sir-lothar', name: 'Sir Lothar', aliases: ['the Grey Knight'], role: 'Marshal of the March', look: 'Grey, scarred.', wears: 'A worn surcoat.', voice: 'Low and dry.', history: 'Served thirty years.', behaviour: ['Loyalty: high - keeps every oath', 'Honesty: medium - omits'], homeBase: 'Ledgerford', start: { place: 'Highmark Capital', goal: 'keep the march quiet', routine: 'drills the guard at dawn' }, keyRelationships: [{ id: 'adalmar', text: 'served him' }], ties: [{ with: 'adalmar', tag: 'serves' }], meters: { trust: 10 },
        stages: [{ name: 'Wary', needs: [{ meter: 'trust', at: 0 }], text: 'He answers questions.' }, { name: 'Trusted', needs: [{ meter: 'trust', at: 40 }, { meter: 'tension', at: -20 }], text: 'He lets You see the ledgers.', milestone: 'lothar-sees-ledgers' }],
        secrets: [{ id: 'letter', gate: 'stage >= "Trusted" or fact:letter-found', text: 'He burned the letter.' }], abilities: [{ name: 'Shield wall', description: 'Holds a line.' }], tastes: [{ item: 'rye', like: true, why: 'home' }], level: 40, protected: true, canDieUnmet: false },
      { kind: 'figure', id: 'toll-keeper', name: 'The Toll-Keeper', role: 'keeps the bridge', ties: [], secrets: [] },
    ],
    lore: [
      { title: 'The Reopening', keys: ['Reopening', 'Wildzone'], text: 'Long ago.', protected: true },
      { title: 'What the Vault Holds', keys: ['vault'], secondaryKeys: ['seal', 'key'], logic: 'and any', text: 'A ledger.', hidden: true, gate: 'fact:vault-opened or meter trust of sir-lothar >= 40' },
      { title: 'Tone of the Marches', keys: ['Marches'], constant: true, order: 10, text: 'Dry and wary.' },
    ],
    worldEvents: [
      { id: 'succession-crisis', kind: 'one-off', certainty: 'likely', reach: 'realm', where: ['Highmark Empire'], requires: ['crown-contested@Highmark Empire', 'died:adalmar', 'score:highmark-stability <= 20'],
        window: { after: 'died:adalmar + 3 days', within: '40 days' }, chance: '70% over the window', likelier_if: { 'unrest@Highmark Capital': '×1.5' }, less_if: { 'regent-named@Highmark Empire': '×0.5' }, pre_empted_by: ['fired:coronation'],
        outcomes: [{ name: 'the regent holds', weight: 'power:princess-wendhild', effects: { set: ['regent-named@Highmark Empire: until cleared'], powers: { 'princess-wendhild': 5 } }, summary: 'Wendhild holds.' }, { name: 'the lords split', weight: 'score:highmark-stability', effects: { scores: { 'highmark-stability': -10 } } }],
        effects: { set: ['unrest@Highmark Capital: 30 days'], cast: [{ who: 'sir-lothar', location: 'Highmark Capital', status: 'summoned', until: 'end', routine: 'attends court' }], facts: [{ id: 'regency-declared', text: 'A regency was declared.' }], on_end: { clear: ['unrest@Highmark Capital'] } },
        ends_when: { for: '40 days', any_of: ['fired:coronation', 'power:ashen-veil <= 10'] }, summary: 'The succession crisis: {outcome}.' },
      { id: 'diet-of-ledgerford', kind: 'chain-stage', certainty: 'likely', reach: 'realm', where: ['Highmark Empire'], requires: ['stage:succession-crisis'], window: { after: 'fired:succession-crisis', within: '60 days' }, ends_when: { for: '10 days' }, summary: 'The lords meet.' },
      { id: 'coronation', kind: 'chain-stage', certainty: 'set-in-motion', reach: 'world', where: ['Highmark Empire'], requires: ['crown-contested@Highmark Empire'], requires_any: ['stage:diet-of-ledgerford', 'fired:succession-crisis + 90 days'], window: { after: 'fired:succession-crisis', within: '150 days' },
        effects: { facts: [{ id: 'new-emperor-crowned', text: 'A new ruler was crowned.' }], on_end: { clear: ['crown-contested@Highmark Empire', 'regent-named@Highmark Empire'], scores: { 'highmark-stability': 15 } } }, ends_when: { for: '3 days' }, summary: 'Highmark crowns a successor.' },
      { id: 'famine', kind: 'recurring', certainty: 'possible', reach: 'regional', where: 'where conditions fit', requires: ['harvest-failed@region'], chance: '30% per season', cooldown: '1 season per place', likelier_if: { 'roads-closed@route': '×2' }, effects: { set: ['grain-dear@region: 1 season'] }, ends_when: { for: '30 days' }, summary: 'Famine grips {region}.' },
      { id: 'dungeon-break', kind: 'recurring', certainty: 'possible', reach: 'local', where: { kinds: ['dungeon'] }, cooldown: '1 season per place', ends_when: 'instant', summary: 'A break.' },
      { id: 'war-of-faiths', kind: 'one-off', certainty: 'likely', reach: 'world', where: ['the-marches'], requires: ['crown-contested@Highmark Empire', 'power:ashen-veil >= 40'], window: { after: 'start', within: '120 days' }, chance: '50% over the window', effects: { set: ['fallen@Veil Cellar: 40 days'] }, ends_when: { for: '60 days', any_of: ['power:ashen-veil <= 10', 'fired:coronation'] }, summary: 'War.' },
    ],
    templates: [
      { template: 'bread-riot', scope: 'place', severity: 'minor', reach: 'local', needs: ['grain-dear@region'], sets: ['unrest@place: 10 days'], cooldown: '1 season per place', summary: 'Riots in {place}.' },
      { template: 'reconstruction', scope: 'place', severity: 'major', reach: 'regional', needs: ['fallen@place'], sets: ['unrest@place: 5 days'], clears: ['fallen@place'], cooldown: '1 year per place', summary: '{place} is rebuilt.' },
    ],
  },
};
export const check = value => validatePack(JSON.stringify(value));
