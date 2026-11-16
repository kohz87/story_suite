// Shared dossier fixtures (alive, away, deceased, presumed with unknown gender) plus the cast ties for People > Map.

import { PEOPLE } from './people.js';

export const TIES = Object.freeze([
  Object.freeze({ a: 'temiwa', b: 'torka', kind: 'friend' }),
  Object.freeze({ a: 'temiwa', b: 'oyla', kind: 'owes' }),
  Object.freeze({ a: 'torka', b: 'brann', kind: 'friend' }),
  Object.freeze({ a: 'brann', b: 'rika', kind: 'friend' }),
  Object.freeze({ a: 'torka', b: 'oyla', kind: 'rival' }),
]);

const BLANK_PROFILE = {
  gender: null, species: null, age: null, home: null, aliases: null,
  looks: null, personality: null, speech: null, background: null, habits: [],
};

function base(id, extra) {
  const p = PEOPLE.cast.find(c => c.personId === id);
  const here = p.at === 'here';
  return {
    id,
    name: p.name,
    portrait: p.portrait,
    idLine: '',
    life: 'alive',
    genderUnknown: false,
    following: p.followed,
    inParty: p.inParty,
    meters: { ...p.meters },
    stage: null,
    changes: [],
    mood: p.mood || null,
    moodBars: { feeling: 0, energy: 0, control: 0 },
    now: here
      ? { where: p.where, doing: p.doing, wearing: p.wearing, thought: p.thought || null }
      : { lastPlace: p.lastPlace, lastSeen: p.lastSeen, said: p.said },
    scene: p.scene ? { ...p.scene } : null,
    ties: [],
    past: [],
    secrets: { opened: 0, total: 0, items: [] },
    profile: { ...BLANK_PROFILE, habits: [] },
    death: null,
    ...extra,
  };
}

const bars = (feeling, energy, control) => ({ feeling, energy, control });

const temiwa = base('temiwa', {
  idLine: 'Human · female · 26',
  moodBars: bars(1, 0, -1),
  stage: { now: 'Acquaintance', next: 'Friend', needs: 'Trust 30 and a danger faced together' },
  changes: [
    { date: 'Goldwane 13', meter: 'trust', delta: 2, why: 'you handed back the offering coin she dropped', heldBack: false },
    { date: 'Goldwane 11', meter: 'affection', delta: 5, why: 'she liked that you wore her ring', heldBack: false },
    { date: 'Goldwane 9', meter: 'trust', delta: 5, why: 'you kept Torka from drawing on the guard', heldBack: false },
    { date: 'Goldwane 9', meter: 'tension', delta: -4, why: 'you spoke to her before the clerk', heldBack: false },
  ],
  ties: [
    { personId: 'torka', portrait: 'torka', name: 'Torka', line: 'friend · childhood · Tem to her' },
    { personId: null, portrait: null, name: 'Oyla', line: 'owes · works beside her, uneasy' },
    { personId: null, portrait: null, name: 'the Harbour Master', line: 'owes · the chapel owes him a debt' },
  ],
  past: [
    { date: 'Goldwane 13', text: 'Handed back the offering coin she dropped. Trust +2.', dayRef: 'Goldwane 13' },
    { date: 'Goldwane 11', text: 'Gave you a silver ring for the road “so the sea knows you”.', dayRef: 'Goldwane 11' },
    { date: 'Goldwane 9', text: 'Met at the Guild Office; wary of Torka’s sword.', dayRef: null },
  ],
  secrets: {
    opened: 1,
    total: 3,
    items: [
      { open: true, title: 'Grew up in the same orphanage as Torka', rule: 'Opened · Trust 15', text: 'She and Torka shared the Bluewatch orphanage until Temiwa went inland.' },
      { open: false, title: null, rule: 'Opens at Trust 40', text: null },
      { open: false, title: null, rule: 'Opens with the story', text: null },
    ],
  },
  profile: {
    gender: 'Female', species: 'Human', age: '26 (looks early twenties)',
    home: 'Bluewatch chapel, above the harbour', aliases: 'Tem (only Torka uses it)',
    looks: 'Tall, dark hair under a white veil, soft brown eyes, a burn scar across the back of her left hand.',
    personality: 'Careful and formal with strangers; warm and dry-humoured once trust is earned.',
    speech: 'Quiet and precise; quotes the Ledger when nervous.',
    background: 'Raised in the Bluewatch orphanage with Torka; trained at the inland temple and came back after a quarrel she will not name.',
    habits: ['Touches the gold thread on her veil when she lies', 'Folds her hands before answering', 'Checks the door when she enters a room'],
  },
});

const torka = base('torka', {
  idLine: 'Orc · female · 24',
  moodBars: bars(0, 2, 0),
  stage: { now: 'Friend', next: 'Close friend', needs: 'Affection 40 and a promise kept' },
  changes: [{ date: 'Goldwane 13', meter: 'affection', delta: 1, why: 'asked +8 · held back: an ordinary moment moves a feeling at most 1', heldBack: true }],
  ties: [
    { personId: 'temiwa', portrait: 'temiwa', name: 'Sister Temiwa', line: 'friend · childhood' },
    { personId: 'brann', portrait: 'brann', name: 'Brann', line: 'friend · fights beside her' },
    { personId: null, portrait: null, name: 'Oyla', line: 'rival · slammed the counter at him' },
  ],
  past: [{ date: 'Goldwane 12', text: 'Argued the contract pay down to five silver.', dayRef: 'Goldwane 12' }],
  secrets: { opened: 0, total: 1, items: [{ open: false, title: null, rule: 'Opens at Trust 60', text: null }] },
  profile: { ...BLANK_PROFILE, gender: 'Female', species: 'Orc', habits: ['Rests a hand on her sword when angry'] },
});

const rika = base('rika', {
  idLine: 'Elf · female · 90 (looks 20)',
  stage: { now: 'Acquaintance', next: 'Friend', needs: 'Trust 30' },
  past: [{ date: 'Goldwane 13', text: 'Stayed at the Bluewatch stables with the horses.', dayRef: null }],
  profile: { ...BLANK_PROFILE, gender: 'Female', species: 'Elf', age: '90 (looks 20)', habits: ['Talks to the horses before the party'] },
});

const marro = base('marro', {
  idLine: 'Human · male · 61',
  life: 'deceased',
  mood: null,
  past: [
    { date: 'Goldwane 12', text: 'Found dead at the toll gate after the bandits passed. You buried him by the milestone.', dayRef: 'Goldwane 12' },
    { date: 'Goldwane 8', text: 'Let you through the toll for a song and a story about the sea.', dayRef: 'Goldwane 8' },
  ],
  secrets: { opened: 1, total: 1, items: [{ open: true, title: 'Waved the bandits through for a share of the toll', rule: 'Opened · Goldwane 12', text: 'A note in his strongbox lists what the bandits paid him.' }] },
  profile: { ...BLANK_PROFILE, gender: 'Male', species: 'Human', habits: ['Counted every coin twice'] },
  death: { ...PEOPLE.cast.find(c => c.personId === 'marro').death },
});

const dren = base('dren', {
  idLine: 'Human · gender unknown',
  life: 'presumed',
  genderUnknown: true,
  mood: null,
  past: [{ date: 'Goldwane 10', text: 'Last seen ferrying at the east ford before the flood.', dayRef: null }],
  profile: { ...BLANK_PROFILE, species: 'Human' },
  death: { ...PEOPLE.cast.find(c => c.personId === 'dren').death },
});

export const DOSSIERS = Object.freeze({ temiwa, torka, rika, marro, dren });

export function dossierFor(personId) {
  const d = DOSSIERS[personId];
  return d ? structuredClone(d) : null;
}
