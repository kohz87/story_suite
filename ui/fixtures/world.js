// Shared world fixtures (map, trip, news, factions) with variants: default, fightOpen (on the road), empty.

const PLACES = [
  ['bluewatch', 'Bluewatch', 'Port town', 'The Salt Coast', 600, 440, true, 'safe', ['temiwa', 'torka', 'brann', 'oyla'], []],
  ['oldweir', 'Old Weir', 'Ford and mill', 'The Salt Coast', 470, 382, true, 'safe', [], []],
  ['auvoth', 'Auvoth', 'Market town', 'Auvoth Vale', 300, 300, false, 'risky', [], ['Missing boatman']],
  ['hollin', 'Hollin’s Reach', 'Village', 'The Salt Coast', 400, 500, true, 'safe', [], []],
  ['wolfmere', 'Wolfmere Outpost', 'Frontier outpost', 'Auvoth Vale', 170, 440, false, 'dangerous', [], []],
  ['varnhold', 'Varnhold Watch', 'Watchtower', 'Auvoth Vale', 140, 170, false, 'risky', [], []],
  ['sails', 'Thousand Sails', 'Free city', 'The Salt Coast', 880, 515, false, 'safe', [], ['Word to the harbour']],
  ['saltmarsh', 'Saltmarsh ruin', 'Ruin', 'The Salt Coast', 470, 575, true, 'dangerous', [], []],
  ['harrowgate', 'Harrowgate', 'Port town', 'Harrow Coast', 950, 300, false, 'safe', [], []],
];

const ROUTES = [
  ['road', 'bluewatch', 'oldweir'], ['road', 'oldweir', 'auvoth'], ['road', 'bluewatch', 'sails'],
  ['road', 'bluewatch', 'harrowgate'], ['track', 'auvoth', 'varnhold'], ['track', 'auvoth', 'wolfmere'],
  ['track', 'oldweir', 'hollin'], ['track', 'bluewatch', 'saltmarsh'],
];

const LEGS = [
  { from: 'Guild Office', to: 'Bluewatch gate', km: null, minutes: 30, note: 'a short walk in town' },
  { from: 'Bluewatch', to: 'Old Weir', km: 3, minutes: 72, note: 'road' },
  { from: 'Old Weir', to: 'Auvoth', km: 9, minutes: 216, note: 'road' },
];

const NEWS = [
  ['bandit-tolls', 'Bandit tolls on the Auvoth road', 'looming', 'Men in grey collect a “bridge fee” at the Auvoth bridge.', 'auvoth', 'men-in-grey', [['in Bluewatch', 'this morning', 'a carter at the guild']]],
  ['frontier-raids', 'Raids on the frontier road', 'ongoing', 'A caravan burned at the Wolfmere crossing; the guild is hiring guards.', 'wolfmere', 'guild', [['in Bluewatch', 'Goldwane 12', 'the guild notice board'], ['in Bluewatch', 'this morning', 'Oyla, at the guild desk']]],
  ['grain-toll', 'Grain toll in Thousand Sails', 'looming', 'The Council of Sails means to double the river toll.', 'sails', 'council', [['in Bluewatch', 'yesterday, Goldwane 12', 'Captain Ilse']]],
  ['harvest-fair', 'Harvest fair at Auvoth', 'looming', 'The fair is set for Goldwane 16.', 'auvoth', null, [['in Bluewatch', 'Goldwane 12', 'a messenger at the guild']]],
  ['missing-boatman', 'A boatman gone missing', 'rumour', 'Fishwives say Hal the boatman never came back from the Saltmarsh.', 'saltmarsh', null, [['on the east quay', 'Goldwane 11', 'talk among the fishwives']]],
  ['toll-keeper', 'The toll keeper killed', 'resolved', 'Old Marro died at his gate when the bandits passed; you buried him.', null, 'men-in-grey', [['at the toll gate', 'Goldwane 12', null]]],
];

const FACTIONS = [
  ['guild', 'Bluewatch Guild', 'friendly', 'The adventurers’ guild of the Salt Coast; holds your writ.', ['bluewatch'], [[null, 'Oyla'], ['brann', 'Brann']]],
  ['chapel', 'Bluewatch Chapel', 'warm', 'The harbour chapel; owes the Harbour Master a debt.', ['bluewatch'], [['temiwa', 'Sister Temiwa']]],
  ['council', 'Council of Sails', 'neutral', 'The merchant council that rules Thousand Sails.', ['sails'], [[null, 'the Harbour Master']]],
  ['red-cord', 'Red Cord', 'unfriendly', 'A sellsword company out of Harrowgate. Torka owes them.', ['harrowgate'], []],
  ['men-in-grey', 'Men in Grey', 'hostile', 'Bandits taking tolls on the Auvoth road. You know little more.', ['auvoth'], []],
];

export const WORLD = Object.freeze({ places: PLACES, routes: ROUTES, legs: LEGS, news: NEWS, factions: FACTIONS });

function buildTrip(fightOpen) {
  return {
    state: fightOpen ? 'road' : 'planned',
    placeIds: ['bluewatch', 'oldweir', 'auvoth'],
    legs: LEGS.map(l => ({ ...l })),
    leave: 'about 10:00 am',
    arrive: 'about 3:18 pm',
  };
}

export function worldFor(variant = 'default') {
  const key = typeof variant === 'string' ? variant.toLowerCase() : '';
  const fightOpen = key === 'fightopen' || key === 'fight-open';
  if (key === 'empty') return { places: [], routes: [], trip: null, news: [], factions: [] };
  const places = PLACES.map(([id, name, kind, region, x, y, visited, danger, people, quests]) => ({
    id, name, kind, region, x, y, visited, here: !fightOpen && id === 'bluewatch', danger,
    people: fightOpen ? [] : [...people], quests: [...quests],
  }));
  if (fightOpen) {
    places.push({ id: 'auvoth-bridge', name: 'Auvoth bridge', kind: 'Bridge', region: 'Auvoth Vale', x: 360, y: 330, visited: true, here: true, danger: 'dangerous', people: [], quests: [] });
  }
  return {
    places,
    routes: ROUTES.map(([kind, a, b]) => ({ kind, a, b })),
    trip: buildTrip(fightOpen),
    news: NEWS.map(([id, title, state, summary, placeId, factionId, heard]) => ({
      id, title, state, summary, placeId, factionId,
      heard: heard.map(([where, when, from]) => ({ where, when, from })),
    })),
    factions: FACTIONS.map(([id, name, stance, summary, areaPlaceIds, members]) => ({
      id, name, stance, summary, areaPlaceIds: [...areaPlaceIds],
      members: members.map(([personId, nm]) => ({ personId, name: nm })),
    })),
  };
}
