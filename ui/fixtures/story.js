// Builds the Story tab fixture (plan switch, pulse, arc, agendas, cast, secrets, ripples, trackers) from the shared moment.

const BEATS = [
  { title: 'Temiwa’s request', state: 'ready', text: 'When you are next alone with Temiwa she asks you to look into the chapel’s debt.', when: 'with Sister Temiwa · any day', personId: 'temiwa' },
  { title: 'The bridge ambush', state: 'wait', text: 'The men in grey stop the party at the Auvoth bridge and demand the fee.', when: 'Auvoth bridge · on arrival', personId: null },
  { title: 'Hal in the Saltmarsh', state: 'wait', text: 'Hal is found alive, hiding from the men who sank his boat.', when: 'Saltmarsh ruin · after asking at the Auvoth docks', personId: null },
];
const CLOCKS = [
  { title: 'Rising river', text: 'the Old Weir ford closes when the Vein crests', due: 'Goldwane 16', shown: 'sign' },
  { title: 'The Red Cord closes in', text: 'they reach Bluewatch', due: 'Goldwane 15', shown: 'none' },
];
const HOOKS = [
  { title: 'A buyer for the east-quay crate', text: 'A harbour clerk offers coin for whatever the unclaimed crate holds. It is a separate offer from the crate lead you already heard of.', when: 'offered after the harbour letter' },
];
const NEWS = [
  { title: 'Fire at the Harrowgate granary', text: 'Half the winter grain burned.', reaches: 'reaches you Goldwane 14', how: 'riders on the coast road · morning' },
];
const AGENDAS = [
  ['The hunt for Torka', 'Red Cord', null, 'Three riders follow Torka’s trail from Harrowgate.', 1, 3, 'Goldwane 12', 'coast road, 30 km out', 'reach Bluewatch Goldwane 15, evening (riding, 35 km/day)', 'heading your way', true],
  ['Torka’s deed-hunt', 'Torka', 'torka', 'She means to take the ridge bounty herself.', 1, 2, 'Goldwane 12', 'Guild Office, Bluewatch', 'walks out at dusk today (Varnhold Watch, 31 km on foot, arrives Goldwane 15)', 'in your party', true],
  ['A higher bridge fee', 'Men in Grey', null, 'They mean to double the fee before the harvest fair.', 2, 3, 'Goldwane 11', 'Auvoth bridge', 'double the fee on Goldwane 15', 'on your route', true],
  ['A quiet fix in the ledger', 'Oyla', null, 'Means to hide the guild advance he gave you in last month’s ledger.', 0, 2, 'Goldwane 13', 'Guild Office, Bluewatch', 'does it tonight after the office closes', 'here', true],
  ['The stalled loan', 'the Harbour Master', null, 'He stalls the chapel’s loan to force the sale of its harbour plot.', 1, 2, 'Goldwane 10', 'Thousand Sails', 'refuses Temiwa’s letter if it comes after Goldwane 14', 'due Goldwane 14', false],
  ['Ilse’s cargo', 'Captain Ilse', null, 'She means to sell her salt in Harrowgate before the price falls.', 0, 2, 'Goldwane 12', 'at sea, bound for Harrowgate', 'arrives Goldwane 15, sells the next day', 'due Goldwane 16', false],
  ['The toll vote', 'Council of Sails', null, 'The council means to double the river toll.', 1, 2, 'Goldwane 12', 'Thousand Sails', 'votes on Goldwane 20', 'due Goldwane 20', false],
].map(([title, who, whoId, text, step, of, since, place, next, why, toldThisReply]) => ({
  title, who, whoId, text, step, of, since, place, next, why, toldThisReply,
}));
const SECRETS = [
  { title: 'Temiwa’s second ledger', text: 'The chapel keeps a second ledger of the debts it forgave; the Harbour Master wants it.', state: 'held', personId: 'temiwa' },
  { title: 'Who pays the men in grey', text: 'The Council of Sails pays the bandits to choke Auvoth’s trade.', state: 'held', personId: null },
  { title: 'Hal’s cargo', text: 'Hal’s sunk boat carried the second ledger’s copy.', state: 'held', personId: null },
];
const RIPPLES = [
  { name: 'Council of Sails', sway: 40 },
  { name: 'Red Cord', sway: 35 },
  { name: 'Bluewatch Guild', sway: 25 },
];
const RECENT = [
  [false, '14', 'Rumour', 'A carter talks about men in grey at the Auvoth bridge.', 'rumour recorded'],
  [false, '9', 'Calm', 'nothing happened', null],
  [true, null, 'Skipped', 'quiet scene', null],
  [true, null, 'Skipped', 'resting', null],
  [false, '17', 'Arrival', 'Riders reach the coast road.', 'arrival set'],
].map(([skipped, roll, kind, text, effect]) => ({ skipped, roll, kind, text, effect }));
const TRACKERS = [
  {
    id: 'chapel-debt', name: 'Chapel debt', showOnNow: true,
    fields: [
      { label: 'Owed', value: '120 silver', kind: 'bar', pct: 83, tone: 'bad' },
      { label: 'Paid', value: '20 silver', kind: 'bar', pct: 17, tone: 'ok' },
      { label: 'Due', value: 'Goldwane 30 · in 17 days', kind: 'text' },
    ],
  },
  {
    id: 'ships-stores', name: 'Ship’s stores', showOnNow: false,
    fields: [
      { label: 'Water', value: '6 of 10 casks', kind: 'bar', pct: 60, tone: 'info' },
      { label: 'Rations', value: '14 days', kind: 'bar', pct: 70, tone: 'warn' },
      { label: 'Morale', value: 'steady', kind: 'text' },
    ],
  },
];

// Plan-gated lists carry their count always and their items only while the plan is shown.
const gate = (list, shown) => ({ count: list.length, items: shown ? list.map(x => ({ ...x })) : [] });

export function buildStory(opts = {}) {
  const shown = Boolean(opts.planShown);
  if (opts.empty) {
    return {
      plan: { shown },
      pulse: { mode: 'lively', quiet: false, latest: null, recent: [] },
      arc: { accepted: null, plan: null },
      beats: gate([], shown), clocks: gate([], shown), hooks: gate([], shown), newsOnWay: gate([], shown),
      agendas: gate([], shown),
      cast: { total: 0, met: 0, unmet: 0, lastMoved: null },
      secrets: gate([], shown), ripples: gate([], shown),
      trackers: [], trackersHidden: 0,
    };
  }
  return {
    plan: { shown },
    pulse: {
      mode: 'lively',
      quiet: Boolean(opts.quiet),
      // What a roll was and caused is plan-gated; the skip reasons are not spoilers.
      latest: opts.quiet ? null : { roll: 14, kind: shown ? 'Rumour' : null, cause: shown ? 'A carter at the guild talks about men in grey at the Auvoth bridge. It became the news “Bandit tolls on the Auvoth road”.' : null },
      recent: RECENT.map(r => ({ ...r, kind: shown || r.skipped ? r.kind : 'Rolled', text: shown || r.skipped ? r.text : '', effect: shown ? r.effect : null })),
    },
    arc: {
      accepted: 'Goldwane 12',
      plan: shown
        ? {
          title: 'The Grey Toll',
          text: 'The bandits on the Auvoth road are paid from Thousand Sails. The chapel’s debt, Hal’s disappearance and the bridge fee are one knot; the arc ends when the party learns who pays the men in grey, or the chapel loses its harbour plot.',
          summary: '3 beats · 2 clocks · 3 secrets · ends: the payer is known, or Goldwane 30 passes',
        }
        : null,
    },
    beats: gate(BEATS, shown),
    clocks: gate(CLOCKS, shown),
    hooks: gate(HOOKS, shown),
    newsOnWay: gate(NEWS, shown),
    agendas: gate(AGENDAS, shown),
    cast: { total: 6, met: 2, unmet: 4, lastMoved: 'Goldwane 13 at dawn' },
    secrets: gate(SECRETS, shown),
    ripples: gate(RIPPLES, shown),
    trackers: TRACKERS.map(t => ({ ...t, fields: t.fields.map(f => ({ ...f })) })),
    trackersHidden: 1,
  };
}
