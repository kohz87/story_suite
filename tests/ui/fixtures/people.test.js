import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE } from '../../../ui/fixtures/people.js';

test('PEOPLE cast has present, away, deceased, and dormant records', () => {
  const byId = new Map(PEOPLE.cast.map(p => [p.personId, p]));
  assert.equal(byId.get('temiwa').at, 'here');
  assert.equal(byId.get('torka').at, 'here');
  assert.equal(byId.get('brann').at, 'here');
  assert.equal(byId.get('oyla').at, 'here');
  assert.equal(byId.get('oyla').portrait, null);

  const rika = byId.get('rika');
  assert.equal(rika.at, 'away');
  assert.equal(rika.inParty, true);
  assert.equal(rika.lastPlace, 'At the Bluewatch stables with the horses');
  assert.equal(rika.lastSeen, '8:00 am');

  assert.equal(byId.get('marro').death.presumed, false);
  assert.equal(byId.get('dren').death.presumed, true);
  assert.equal(byId.get('della').at, 'dormant');
});

test('PEOPLE fightOverrides cover bridge party members', () => {
  assert.equal(PEOPLE.fightOverrides.brann.where, 'at the front, shield up');
  assert.equal(PEOPLE.fightOverrides.torka.where, 'beside you');
  assert.equal(PEOPLE.fightOverrides.rika.where, 'by the grey pony');
});
