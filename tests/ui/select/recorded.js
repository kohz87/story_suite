// Recorded query answers for the selector tests, written from the real query code (file:line beside each).

export const ANSWERS = {
  // SD/tracker/domain.js:326 director.time
  'director.time': { minutes: 570, text: 'Goldwane 13, 611, 9:30 am', parts: { year: 611, month: 1, day: 13, minutes: 570 } },
  // SD/screens/queries.js:386 statusExtras
  'director.status': { summary: '9:30 am, Guild Office', when: 'Goldwane 13, 611, 9:30 am', place: 'Bluewatch · Guild Office', region: 'Bluewatch', coords: '', weather: 'cold drizzle' },
  // SB/domains/scene.js:92, :95, :102
  'scene.place': { name: 'Guild Office', region: 'Bluewatch', kind: 'office' },
  'scene.weather': { text: 'cold drizzle' },
  'scene.you': { wearing: 'a grey travel coat', condition: 'tired' },
  // SB/lean-rpg/roster.js:57-58
  'party.actors': [{ id: 'a1', name: 'Astra', pc: true }, { id: 'a2', name: 'Wessel' }],
  'party.pc': { id: 'a1', level: 14, className: 'Sellsword', hp: { cur: 42, max: 48 }, mp: { cur: 12, max: 18 }, sp: { cur: 9, max: 9 } },
  'party.terms': { levelName: 'Level' },
  // SB/domains/mounts.js:98 mountsPace
  'mounts.pace': { pace: 25, mounts: 2, riders: 3, short: 1, slowest: 'Burr' },
  // SB/domains/inventory/queries.js:151
  'inventory.encumbrance': { on: true, encumbered: true, party: true, who: [], load: 14, capacity: 12, penalty: -2, stats: ['STR', 'AGI'] },
  'inventory.wallet': { coin: 1546 },
  'inventory.currency': { name: 'gold', plural: 'gold', coins: [{ name: 'gold', plural: 'gold', value: 100, short: 'g' }, { name: 'silver', plural: 'silver', value: 10, short: 's' }, { name: 'copper', plural: 'copper', value: 1, short: 'c' }] },
  // NSD/adapter/queries.js:200 (meters: true), NSD/npc-meters-queries.js:176, SB/domains/core/module.js:84
  'npc.present': [{ id: 'np_fenna', name: 'Fenna', followed: true, meters: { trust: 40, affection: 22, desire: 5, tension: 12 }, stages: {} }],
  'npc.cast': [{ key: 'np_fenna', name: 'Fenna', present: true, bars: [{ id: 'trust', value: 40 }], mood: { word: 'wary' } }],
  'chatter.head': [{ name: 'Fenna', text: 'He is late again.' }],
  // SD/time/index.js:183, SD/screens/queries.js:72 and :131, SD/keypeople/queries.js:64
  'time.overdue': { minutes: 570, lapsed: [], overdue: [{ id: 't1', key: 'Pay the guild', kind: 'quest', due: 'Goldwane 12' }], pay: [], due: [] },
  'director.goal': { id: 't2', key: 'caravan', goal: 'Find the caravan', step: 'Ask at the gate', giver: 'Fenna', due: '', taken: true },
  'director.next': { id: 't1', key: 'Pay the guild', kind: 'quest', summary: 'Pay the guild', field: 'due', when: 'Goldwane 14', at: 1, reached: false },
  'director.keyPeople': [{ name: 'Fenna', here: true, away: null }],
  // SD/atlas/trip-query.js:74 (tripView, trip.js:383)
  'atlas.trip': { on: true, to: 'Auvoth', phase: 'road', leg: 2, legCount: 4, fraction: 0.5, row: 'Bluewatch → Auvoth · leg 2 of 4', legs: [], you: null, movers: [], hasMovers: false },
  // SB/screens/changes-card.js:234 changesDigest (as `reply.digest`), SB/reply-notes.js:51 refusedAt
  'reply.digest': { gained: [{ def: 'rope', name: 'Rope', qty: 1 }], lost: [], held: [], coin: 30, coinNow: null, place: 'Auvoth', arrived: ['Fenna'], left: [], presentNow: null, other: false, loot: 0 },
  'notes.refusedAt': [{ line: '+ item Moon Blade', reason: 'No such item.' }],
};

// SB/domains/gear/views.js:156 gear.view; SB/data-modules/part/views.js:51 dataModules.view
export const GEAR_VIEW = { rows: { s1: { word: 'torn', broken: false }, s2: { word: 'good', broken: false } }, bag: [{ stack: 's1', name: 'Old Cloak' }], slots: { weapon: { stack: 's2', name: 'Short Sword' } } };
export const PINNED = [{ id: 'trk1', name: 'Reputation', view: { chat: { Guild: 12, Town: 'liked' } } }];
