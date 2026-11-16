// Builds the Journal tab fixture (quests, leads, closed, calendar, days, coming up) from the shared moment.

const MONTH_NAMES = ['Deepfrost', 'Snowmelt', 'Seedtime', 'Greening', 'Highsun', 'Harvestide', 'Goldwane', 'Thawmonth', 'Mistmoor', 'Yearsend'];
const WEEKDAYS = ['Firstday', 'Secondday', 'Thirdday', 'Fourthday', 'Fifthday', 'Sixthday', 'Restday'];
const FIRST_YEAR = 611;
const LAST_YEAR = 615;
const MONTH_LENGTH = 30;
const TODAY = { month: 6, day: 13 };
const START = { month: 6, day: 9 };
const WEEKDAY_SHORT = ['F', 'S', 'T', 'F', 'F', 'S', 'R'];

const QUESTS = [
  {
    id: 'over', title: 'Brann’s smith bill',
    summary: 'Pay the Bluewatch smith for Brann’s mended mail before he sends the watch.',
    steps: ['Pay 30 silver at the smithy'], stepIndex: 0,
    giver: { personId: 'brann', name: 'Brann', portrait: 'brann' },
    due: { date: 'Goldwane 12', rel: '1 day late', state: 'late' },
    place: 'Bluewatch', stepPlace: 'Bluewatch', reward: null, difficulty: 'easy',
  },
  {
    id: 'boat', title: 'Missing boatman',
    summary: 'Find Hal the boatman, last seen heading for the Saltmarsh.',
    steps: ['Ask at the Bluewatch docks', 'Reach Auvoth and ask at the docks', 'Search the Saltmarsh'], stepIndex: 1,
    giver: { personId: 'temiwa', name: 'Sister Temiwa', portrait: 'temiwa' },
    due: { date: 'Goldwane 18', rel: 'in 5 days', state: '' },
    place: 'Auvoth', stepPlace: 'Auvoth', trip: 'Trip to Auvoth planned: leave about 10:00 am, arrive about 3:18 pm (town hop, then 12 km on foot)',
    reward: '40 copper', difficulty: 'normal',
  },
  {
    id: 'harb', title: 'Word to the harbour',
    summary: 'Carry the sealed letter to the Harbour Master in Thousand Sails.',
    steps: ['Hand the letter to the Harbour Master'], stepIndex: 0,
    giver: { personId: 'oyla', name: 'Oyla' },
    due: { date: 'Goldwane 14', rel: 'tomorrow', state: 'soon' },
    place: 'Thousand Sails', stepPlace: 'Thousand Sails', reward: '1 silver', difficulty: 'easy',
  },
  {
    id: 'hound', title: 'Bounty on the ridge hounds',
    summary: 'Clear the hounds harrying the north farms.',
    steps: ['Take the bounty at the guild', 'Track the pack along the ridge path', 'Clear the hounds'], stepIndex: 1,
    giver: { personId: null, name: 'Bluewatch Guild' },
    due: null, place: 'Varnhold Watch', stepPlace: 'Varnhold Watch', reward: '60 copper', difficulty: 'hard',
  },
];

const LEADS = [
  { title: 'Guards wanted for the frontier road', from: 'Bluewatch Guild', where: 'notice board · Bluewatch · 2 silver a day', lapses: 'Goldwane 20' },
  { title: 'Wants a guard for her voyage home', from: 'Captain Ilse', where: 'said at the Gull · to Harrowgate', lapses: 'Goldwane 18' },
  { title: 'A crate nobody has claimed', from: 'Fishwives on the east quay', where: 'harbour talk · Bluewatch', lapses: 'Goldwane 16' },
];

const CLOSED = [
  { title: 'Wolf tracks on the ridge', outcome: 'done', detail: 'Finished Goldwane 13 · giver Torka', paid: '+40 copper' },
  { title: 'Dock work at the east quay', outcome: 'declined', detail: 'Declined Goldwane 11 · offered by the dock foreman', paid: null },
  { title: 'Escort to Hollin’s Reach', outcome: 'lapsed', detail: 'Offer lapsed Goldwane 12 · deadline Goldwane 10, plus 2 days because you spoke of it', paid: null },
  { title: 'The toll keeper’s request', outcome: 'failed', detail: 'Failed Goldwane 12 · Old Marro died before you came back', paid: null },
  { title: 'Lost goat at Hollin’s Reach', outcome: 'gaveup', detail: 'Given up Goldwane 10', paid: null },
];

const NO_QUESTS = { taken: [], done: [], failed: [], dropped: [] };
const DAYS = [
  {
    day: 13, happened: ['You finished Wolf tracks on the ridge for Torka.', 'Oyla gave you a sealed letter for the Harbour Master.', 'You paid for a room at the Gull; Oyla advanced you 1 silver.', 'You heard of bandit tolls on the Auvoth road.'],
    places: [], quests: { ...NO_QUESTS, taken: ['Word to the harbour'], done: ['Wolf tracks on the ridge'] }, fights: 0,
    money: { in: '1 silver', out: '8 copper' }, stageMoves: [{ who: 'Torka', meter: 'Trust', from: 'Acquaintance', to: 'Friend' }],
    met: [], world: ['Bandit tolls on the Auvoth road'],
  },
  {
    day: 12, happened: ['Old Marro was killed at the toll gate; you found him and buried him.', 'You bought salted fish, blue wool and a steel helm.', 'Raids on the frontier road began.'],
    places: [], quests: { ...NO_QUESTS, failed: ['The toll keeper’s request'] }, fights: 0,
    money: { in: null, out: '1 gold 24 copper' }, stageMoves: [], met: [], world: ['Raids on the frontier road'],
  },
  {
    day: 11, happened: ['Sister Temiwa gave you a silver ring.', 'You picked moonpetal on the cliff path.', 'You learned Temiwa grew up in the same orphanage as Torka.'],
    places: [], quests: NO_QUESTS, fights: 0, money: { in: null, out: null }, stageMoves: [], met: [], world: [],
  },
  {
    day: 10, happened: ['You gave up looking for the goat.', 'You mined iron ore at the old cut.'],
    places: ['Hollin’s Reach'], quests: { ...NO_QUESTS, dropped: ['Lost goat at Hollin’s Reach'] }, fights: 0,
    money: { in: null, out: null }, stageMoves: [], met: [], world: [],
  },
  {
    day: 9, happened: ['The story begins: you arrived in Bluewatch.', 'You met Sister Temiwa and Oyla at the Guild Office.', 'You kept Torka from drawing on the guard.', 'You bought supplies.'],
    places: ['Bluewatch'], quests: NO_QUESTS, fights: 0, money: { in: null, out: null },
    stageMoves: [{ who: 'Sister Temiwa', meter: 'Trust', from: 'Stranger', to: 'Acquaintance' }, { who: 'Oyla', meter: 'Trust', from: 'Stranger', to: 'Acquaintance' }],
    met: ['Sister Temiwa', 'Oyla'], world: [],
  },
];

const UPCOMING = [
  { group: 'late', name: 'Brann’s smith bill', day: 12, rel: '1 day late', kind: 'quest due', glyph: '⚒', tone: 'bad' },
  { group: 'soon', name: 'Word to the harbour', day: 14, rel: 'tomorrow', kind: 'quest due', glyph: '✉', tone: 'warn' },
  { group: 'week', name: 'Harvest fair at Auvoth', day: 16, rel: 'in 3 days', kind: 'event you heard of', glyph: '✦', tone: 'info' },
  { group: 'week', name: 'Missing boatman', day: 18, rel: 'in 5 days', kind: 'quest due', glyph: '⚓', tone: 'warn' },
  { group: 'later', name: 'Autumn tithe at the chapel', day: 30, rel: 'in 17 days', kind: 'event you heard of', glyph: '✦', tone: 'info' },
];

function dayLine(r, date) {
  const p = [];
  if (r.places.length) p.push(`to ${r.places.join(', ')}`);
  if (r.quests.taken.length) p.push(`took on ${r.quests.taken.join(', ')}`);
  if (r.quests.done.length) p.push(`finished ${r.quests.done.join(', ')}`);
  if (r.quests.failed.length) p.push(`failed ${r.quests.failed.join(', ')}`);
  if (r.quests.dropped.length) p.push(`gave up ${r.quests.dropped.join(', ')}`);
  if (r.fights) p.push(`${r.fights} fight${r.fights === 1 ? '' : 's'}`);
  if (r.money.in || r.money.out) p.push(r.money.in && r.money.out ? `${r.money.in} in, ${r.money.out} out` : r.money.in ? `${r.money.in} in` : `${r.money.out} out`);
  if (r.stageMoves.length) p.push(`${r.stageMoves.length} NPC stage${r.stageMoves.length === 1 ? '' : 's'} moved`);
  if (r.world.length) p.push(`${r.world.length} world event${r.world.length === 1 ? '' : 's'}`);
  if (!p.length) p.push(r.happened[0] ? r.happened[0].replace(/[.!?…]+$/, '') : 'kept');
  return `${date}: ${p.join('; ')}.`;
}

function buildCalendar() {
  const months = [];
  for (let i = 0; i < (LAST_YEAR - FIRST_YEAR + 1) * 10; i += 1) {
    months.push({ name: MONTH_NAMES[i % 10], length: MONTH_LENGTH, firstWeekday: (i * MONTH_LENGTH) % 7, year: FIRST_YEAR + Math.floor(i / 10) });
  }
  return {
    months,
    weekdays: WEEKDAYS.map((name, i) => ({ short: WEEKDAY_SHORT[i], name })),
    era: 'CY',
    today: { ...TODAY },
    start: { ...START },
  };
}

export function buildJournal(opts = {}) {
  const rpg = opts.rpg !== false;
  if (opts.empty) {
    return { rpg, quests: [], focusId: null, leads: [], closed: [], calendar: buildCalendar(), days: [], planned: [], upcoming: [] };
  }
  const focusId = opts.focus || 'boat';
  const quests = QUESTS.map(q => ({
    ...q,
    stepCount: q.steps.length,
    step: q.steps[q.stepIndex],
    steps: [...q.steps],
    giver: { ...q.giver },
    due: q.due ? { ...q.due } : null,
    trip: q.trip ?? null,
    reward: rpg ? q.reward : null,
    difficulty: rpg ? q.difficulty : null,
  })).sort((a, b) => (b.id === focusId) - (a.id === focusId));
  return {
    rpg,
    quests,
    focusId: quests.some(q => q.id === focusId) ? focusId : null,
    leads: LEADS.map(l => ({ ...l })),
    closed: CLOSED.map(c => ({ ...c, paid: rpg ? c.paid : null })),
    calendar: buildCalendar(),
    days: DAYS.map(d => {
      const date = `${MONTH_NAMES[TODAY.month]} ${d.day}`;
      return { ...structuredClone(d), month: TODAY.month, date, line: dayLine(d, date) };
    }),
    planned: [{ glyph: '➜', title: 'Trip to Auvoth · planned', detail: 'leave when the guild business is done (about 10:00 am), a 30-minute town hop then 12 km on foot at 2.5 km/h, arrive about 3:18 pm' }],
    upcoming: UPCOMING.map(u => ({ ...u, month: TODAY.month, date: `${MONTH_NAMES[TODAY.month]} ${u.day}` })),
  };
}
