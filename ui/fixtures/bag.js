// Builds the shared Bag fixture: items, purse, load, party pace and assets (default, story-only, over the limit).

const R = { '': 'common', unc: 'uncommon', rare: 'rare', epic: 'epic' };
// [name, kind, glyph, rarity, qty, wornBy, isNew, torn, weight, worth, soak, desc, from]
const ITEMS = [
  ['Steel longsword', 'gear', 'weapon', 'rare', 1, 'astra', 0, 0, 3, '1 gold 20 silver', 0, 'A plain soldier’s blade, well kept and recently sharpened.', 'Found in the Saltmarsh ruin · Goldwane 6'],
  ['Oak round shield', 'gear', 'offhand', 'unc', 1, 'astra', 0, 1, 4, '20 silver · torn, half of 40 silver', 1, 'Banded in iron; a split runs along one edge.', 'Bought in Bluewatch · Goldwane 9'],
  ['Travel leathers', 'gear', 'armor', '', 1, 'astra', 0, 0, 5, '30 silver', 0, 'Brown leathers softened by the road.', 'Start of the story'],
  ['Silver ring', 'gear', 'accessory', 'unc', 1, 'astra', 0, 0, 0, '25 silver', 0, 'A thin band with a wave pattern.', 'Gift from Temiwa · Goldwane 11'],
  ['Chain shirt', 'gear', 'armor', 'unc', 1, 'brann', 0, 0, 8, '60 silver', 2, 'Rings patched with newer wire at the shoulder.', 'Brann’s own'],
  ['Red Cord oath-coin', 'gear', 'accessory', 'epic', 1, 'brann', 0, 0, 0, 'not for sale', 0, 'A coin on a red cord, sworn to Brann by a dying captain.', 'Brann’s own'],
  ['Greatsword', 'gear', 'weapon', 'rare', 1, 'torka', 0, 0, 6, '1 gold 50 silver', 0, 'Notched near the hilt.', 'Torka’s own'],
  ['Grey wool cloak', 'gear', 'cloak', '', 1, 'astra', 0, 0, 2, '12 silver', 0, 'Dark with drizzle at the shoulders.', 'Start of the story'],
  ['Riding boots', 'gear', 'feet', '', 1, 'astra', 0, 0, 2, '15 silver', 0, 'Good leather, resoled once.', 'Start of the story'],
  ['Leather satchel', 'gear', 'bagslot', '', 1, 'astra', 0, 0, 1, '10 silver', 0, 'Holds the sealed letter.', 'Start of the story'],
  ['Iron cap', 'gear', 'head', '', 1, 'brann', 0, 0, 2, '15 silver', 1, 'Plain and well dented.', 'Brann’s own'],
  ['Iron axe', 'gear', 'weapon', '', 1, 'brann', 0, 0, 3, '30 silver', 0, 'A woodsman’s axe turned to war.', 'Brann’s own'],
  ['Tower shield', 'gear', 'offhand', '', 1, 'brann', 0, 0, 6, '45 silver', 2, 'Taller than Oyla.', 'Brann’s own'],
  ['Hob boots', 'gear', 'feet', '', 1, 'brann', 0, 0, 2, '10 silver', 0, 'Hobnailed, loud on stone.', 'Brann’s own'],
  ['Scout leathers', 'gear', 'armor', 'unc', 1, 'rika', 0, 0, 4, '40 silver', 0, 'Dyed in shades of moss.', 'Rika’s own'],
  ['Green cloak', 'gear', 'cloak', '', 1, 'rika', 0, 0, 2, '12 silver', 0, 'Hooded, for watching roads.', 'Rika’s own'],
  ['Soft boots', 'gear', 'feet', '', 1, 'rika', 0, 0, 1, '14 silver', 0, 'Quiet on gravel.', 'Rika’s own'],
  ['Short bow', 'gear', 'weapon', '', 1, 'rika', 0, 0, 2, '30 silver', 0, 'Yew, waxed string.', 'Rika’s own'],
  ['Quiver bag', 'gear', 'bagslot', '', 1, 'rika', 0, 0, 1, '8 silver', 0, 'Arrows and a little room besides.', 'Rika’s own'],
  ['Brigandine', 'gear', 'armor', '', 1, 'torka', 0, 0, 7, '50 silver', 2, 'Rivets patched in two colours.', 'Torka’s own'],
  ['Hob boots', 'gear', 'feet', '', 1, 'torka', 0, 0, 2, '10 silver', 0, 'Hobnailed.', 'Torka’s own'],
  ['Lucky ring', 'gear', 'accessory', 'unc', 1, 'torka', 0, 0, 0, '20 silver', 0, 'Brass, worn thin.', 'Torka’s own'],
  ['Spare dagger', 'gear', 'weapon', '', 1, '', 0, 0, 1, '8 silver', 0, 'A cheap but honest blade.', 'Bought in Bluewatch · Goldwane 9'],
  ['Steel helm', 'gear', 'head', 'unc', 1, '', 0, 0, 3, '45 silver', 1, 'Dented over the left eye; fits Brann.', 'Taken from the toll bandits · Goldwane 12'],
  ['Healing draught', 'use', 'use', '', 3, '', 1, 0, 1, '2 silver each', 0, 'Red, bitter, and warm going down.', '2 bought · 1 from the guild advance this turn'],
  ['Antidote', 'use', 'use', 'unc', 1, '', 0, 0, 1, '5 silver', 0, 'Smells of mint and tar.', 'Bought in Bluewatch · Goldwane 9'],
  ['Bread and cheese', 'use', 'use', '', 4, '', 0, 0, 2, '3 copper each', 0, 'Hard bread, sharp cheese.', 'The Gull’s kitchen · Goldwane 13'],
  ['Rope, 50 ft', 'goods', 'goods', '', 1, '', 0, 0, 4, '6 silver', 0, 'Hemp rope, tarred at the ends.', 'Start of the story'],
  ['Salted fish', 'goods', 'goods', '', 6, '', 0, 0, 6, '4 copper each', 0, 'Trade goods for the inland villages.', 'Bought at the east quay · Goldwane 12'],
  ['Bolt of blue wool', 'goods', 'goods', 'unc', 1, '', 0, 0, 5, '1 gold', 0, 'Dyed in Bluewatch; worth more inland.', 'Bought at the dye market · Goldwane 12'],
  ['Iron ore', 'material', 'material', '', 5, '', 0, 0, 5, '2 silver each', 0, 'For the smith in Harrowgate.', 'Mined at the old cut · Goldwane 10'],
  ['Moonpetal', 'material', 'material', 'rare', 2, '', 0, 0, 0, '12 silver each', 0, 'Pale petals that glow faintly at night.', 'Picked on the cliff path · Goldwane 11'],
  ['Sealed letter', 'quest', 'quest', '', 1, '', 1, 0, 0, '—', 0, 'Addressed to the Harbour Master, sealed in blue wax. Do not open.', 'From the guild clerk this turn · quest “Word to the harbour”'],
  ['Guild writ', 'quest', 'quest', '', 1, '', 0, 0, 0, '—', 0, 'Permits the party to take guild contracts in Bluewatch.', 'Guild Office · Goldwane 13'],
];
const SACK = ['Sack of grain', 'goods', 'goods', '', 1, '', 1, 0, 8, '5 silver', 0, 'A sack of grain for the road.', 'Bought at the east quay · this turn'];
const ANVIL = ['Smith’s anvil', 'goods', 'goods', '', 1, '', 1, 0, 50, '8 silver', 0, 'A small travelling anvil, far too heavy.', 'Taken from the guild smith · this turn'];
const FILTERS = ['all', 'worn', 'gear', 'use', 'goods', 'material', 'quest'];
const ASSETS = {
  transport: [
    ['dappled-mare', 'Dappled mare', 'mount', 'Riding animal', ['Astra'], 1, 'At the Bluewatch stables until you set out', true, 'Good, rested', 'Carries +40 load while with the party.', ['horse', 'with the party'], 'equipped'],
    ['grey-pony', 'Grey pony', 'mount', 'Riding animal', ['Rika'], 1, 'At the Bluewatch stables with Rika', true, 'Good, rested', 'Carries +30 load while with the party.', ['pony', 'with the party'], 'equipped'],
    ['covered-cart', 'Covered cart', 'cart', 'Cart, pulled by Bramble the ox', [], 2, 'Parked at the Bluewatch stables', false, 'Good', 'Adds nothing to load or pace while parked. Taken along: 15 km/day, Brann and Torka ride in it.', ['pulled by Bramble the ox', '2 seats', 'parked at the stables'], 'not with you'],
    ['rowboat', 'Rowboat', 'boat', 'Boat', [], 4, 'Moored at the east quay', false, 'Good', 'Water only: counts for nothing on land.', ['4 seats', 'moored at the east quay'], 'water'],
  ],
  property: [
    ['room-at-the-gull', 'Room at the Gull', 'house', 'Rented room', ['Astra', 'Brann', 'Rika', 'Torka'], null, 'Bluewatch · paid to Goldwane 14', false, null, 'Rented by the night; the bill is due on Goldwane 14.', ['rented', 'Bluewatch', 'paid to Goldwane 14'], 'rented'],
    ['mothers-cottage', 'Mother’s cottage', 'house', 'Owned house', [], null, 'Hollin’s Reach · shut up for the season', false, null, 'Owned outright; nobody is staying there.', ['owned', 'Hollin’s Reach', 'shut up for the season'], 'owned'],
  ],
};

const RATES = {
  place: 'Bluewatch · a busy port town',
  rows: [['Meal at an inn', '3 copper'], ['Room for a night', '8 copper'], ['Day’s labour', '12 copper'], ['Healing draught', '2 silver'],
    ['Horse hire, per day', '1 silver'], ['Repair of a torn item', '6 silver'], ['Guild contract pay', '5 to 20 silver']].map(([name, price]) => ({ name, price })),
  note: 'Worked out by the suite from the chat’s coins and economy. The story can haggle; a price it charges shows in the purse with the reason.',
};

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function makeItem(row, rpg) {
  const [name, kind, glyph, rarity, qty, wornBy, isNew, torn, weight, worth, soak, desc, from] = row;
  return {
    stack: name === 'Hob boots' ? `hob-boots-${wornBy}` : slug(name),
    name, kind, glyph, rarity: rpg ? R[rarity] : 'common', qty,
    wornBy: wornBy || null, isNew: Boolean(isNew),
    wear: rpg && kind === 'gear' ? (torn ? 'torn' : 'good') : null,
    weight: rpg ? weight : 0, worth, soak: rpg ? soak : 0, desc, from,
    note: '', hand: rpg && name === 'Spare dagger', slot: kind === 'gear' && glyph === 'weapon' ? 'weapon' : null,
  };
}

function makeAsset(a, rpg) {
  const [id, name, glyph, kindLabel, riders, seats, where, withParty, condition, note, meta, tag] = a;
  return { id, name, glyph, kindLabel, riders: [...riders], seats, where, withParty, condition: rpg ? condition : null, note, meta: [...meta], tag };
}

function makeLoad(items, limit) {
  const value = items.reduce((sum, it) => sum + it.weight * it.qty, 0);
  const level = value >= limit ? 'over' : value >= Math.ceil(limit * 0.8) ? 'heavy' : 'light';
  const part = (label, v, text, dim = false) => ({ label, value: v, text, dim });
  const breakdown = [
    part('Members', 112, 'Members 10 + 2×STR each = 112'), part('Bags', 10, 'Bags +10'),
    part('Dappled mare', 40, 'Dappled mare +40'), part('Grey pony', 30, 'Grey pony +30'),
    part('Covered cart', 0, 'Covered cart +0 (parked)', true),
  ];
  return { value, limit, level, breakdown };
}

// load: 0 light, 1 over (the anvil), 2 heavy (the sack); `over` is the older flag for load 1.
export function bagFixture({ rpg = true, over = false, load: loadStep = 0 } = {}) {
  const rows = over || loadStep === 1 ? [...ITEMS, ANVIL] : loadStep === 2 ? [...ITEMS, SACK] : ITEMS;
  const items = rows.map(r => makeItem(r, rpg));
  const inFilter = (it, key) => (key === 'worn' ? Boolean(it.wornBy) : !it.wornBy && (key === 'all' || it.kind === key));
  const load = rpg ? makeLoad(items, 192) : null;
  const slowed = Boolean(load && load.level === 'over');
  return {
    rpg,
    filters: FILTERS.map(key => ({ key, count: items.filter(it => inFilter(it, key)).length })),
    items,
    purse: {
      coins: { gold: 2, silver: 14, copper: 6 },
      words: '2 gold 14 silver 6 copper',
      thisTurn: [
        { line: 'guild advance', delta: '+1 silver', up: true, earlier: false },
        { line: 'room at the Gull', delta: '−8 copper', up: false, earlier: true },
      ],
      rates: RATES,
    },
    load,
    pace: {
      kmDay: slowed ? 15 : 20,
      by: 'foot',
      slowed,
      why: slowed
        ? 'On foot and over the load limit: 20 km/day less a quarter. Brann and Torka have no mounts, so everyone walks.'
        : rpg
          ? 'On foot: Brann and Torka have no mounts, so everyone walks. Riders lead their animals.'
          : 'On foot: not everyone has a riding animal, so everyone walks. Riders lead their animals.',
      alt: 'Taking the cart: 15 km/day (the ox sets the pace; Brann and Torka ride in it). Two more horses: 30 km/day (Rika’s pony is the slowest).',
    },
    assets: {
      transport: ASSETS.transport.map(a => makeAsset(a, rpg)),
      property: ASSETS.property.map(a => makeAsset(a, rpg)),
    },
  };
}

export const BAG = Object.freeze(bagFixture());
