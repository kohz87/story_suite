// Builds the Settings overlay fixture (schema rows per section, module sets, three connections) at code defaults.

// row(group, key, type, label, value, extra): one schema row; default equals value unless extra.default says otherwise.
function row(group, key, type, label, value, extra = {}) {
  return {
    key, group, type, label,
    hint: extra.hint ?? null,
    value,
    default: 'default' in extra ? extra.default : value,
    options: extra.options ?? null,
    unit: extra.unit ?? null,
    tags: extra.tags ?? [],
  };
}

const sec = (id, group, name, desc, rows, special = null) => ({ id, group, name, desc, special, rows });
const SKINS = ['Glass dark', 'Glass light', 'Follow SillyTavern'];
const TIERS = { Ordinary: 1, Meaningful: 2, Major: 3, Extreme: 6 };
const DAILY = { Ordinary: 3, Meaningful: 1, Major: 1, Extreme: 1 };

function buildSections() {
  return [
    sec('start', 'Play', 'Start', 'How much the suite tracks, and the modules with their features.', [], 'start'),
    sec('look', 'Play', 'Look', 'Skin and text.', [
      row('Skin', 'look.skin', 'seg', 'Skin', 'Glass dark', { hint: 'Glass dark is the default; packs can add skins', options: SKINS, tags: ['merged'] }),
      row('Skin', 'look.glass', 'num', 'Glass strength', 50, { hint: 'How see-through panels are', unit: '%' }),
      row('Skin', 'look.textSize', 'seg', 'Text size', 'Normal', { options: ['Normal', '110%', '120%'] }),
      row('Skin', 'look.sendingNote', 'sw', 'Note while a message is sending', true, { hint: 'A small note under the message box' }),
    ]),
    sec('people', 'Rules', 'People', 'Feelings and their pacing, stages, who gets a dossier, Refresh, portraits and the map.', [
      row('Feelings', 'people.meters', 'info', 'The four feelings', 'fixed', { hint: 'Trust, Affection, Desire, Tension · −100 to +100, 0 means neutral' }),
      row('Feelings', 'people.presets', 'chips', 'Meter presets (up to 12)', [], { hint: 'Companion, Rival, Mentor and pack sets; none are on until you pick them', options: ['Companion', 'Rival', 'Mentor'] }),
      row('Pacing', 'people.tierCaps', 'multi', 'How far one moment moves a feeling', { ...TIERS }, { hint: 'Each change line is rated by how much the moment matters; a deep value resists more' }),
      row('Pacing', 'people.daily', 'multi', 'Moments per story day, per person', { ...DAILY }, { hint: 'Over the allowance a moment counts as the tier below; blank is no limit' }),
      row('Pacing', 'people.ceiling', 'num', 'Safety ceiling per reply', 15, { hint: 'The most one feeling moves in one reply, all lines together; rarely reached' }),
      row('Who gets a dossier', 'people.dossier', 'seg', 'Who gets a dossier', 'Conservative', { options: ['Conservative', 'Balanced', 'Generous'] }),
      row('Who gets a dossier', 'people.dormant', 'num', 'Dormant after', 30, { hint: 'Hidden from the list until seen again (never deleted)', unit: 'replies unseen', tags: ['merged'] }),
      row('Refresh and the narrator', 'people.refreshEvery', 'num', 'Refresh every', 5, { unit: 'replies', tags: ['replaced', 'cost'] }),
      row('Portraits', 'people.portraits', 'sw', 'Generate portraits', true),
    ]),
    sec('rpg', 'Rules', 'RPG and fights', 'Combat Rules v1, progression and fights. The checks’ numbers are in Director.', [
      row('Rules', 'rpg.difficulty', 'seg', 'Difficulty', 'Standard', { hint: 'Custom opens the numbers', options: ['Gentle', 'Standard', 'Harsh', 'Custom'] }),
      row('Rules', 'rpg.odds', 'seg', 'Odds on the fight board', 'Words', { hint: 'Likely / even / long shot on each action', options: ['Words', 'Off'] }),
      row('Progression', 'rpg.levelCap', 'num', 'Level cap', 99, { hint: 'A story or pack can set its own' }),
      row('Progression', 'rpg.xpRate', 'num', 'XP rate', 100, { unit: '%' }),
      row('Fights', 'rpg.companions', 'seg', 'Companions who join', 'Ask', { options: ['Ask', 'Automatically', 'Off'] }),
      row('Fights', 'rpg.autoExchanges', 'num', 'Most exchanges Auto plays', 3, { hint: 'On the fight board' }),
      row('Fights', 'rpg.overLoad', 'info', 'Over the load limit', 'rule', { hint: '−2 to AGI and DEX checks and −25% travel pace; items have their own weights' }),
    ]),
    sec('world', 'Rules', 'World and time', 'One calendar, one weather, the map and time rules.', [
      row('Calendar', 'world.calendar', 'sel', 'Calendar', 'From the pack: Ersveil', { hint: 'From the pack, or a preset', options: ['From the pack: Ersveil'], tags: ['merged'] }),
      row('Calendar', 'world.era', 'txt', 'Era', 'CY', { hint: 'Written before the year' }),
      row('Weather', 'world.weather', 'seg', 'Weather comes from', 'Rolled from the calendar', { options: ['Rolled from the calendar', 'The story only'], tags: ['merged'] }),
      row('Map', 'world.roadsWind', 'num', 'Roads wind', 1.25, { hint: '× the straight line' }),
      row('Map', 'world.travelHours', 'num', 'Hours on the road per travel day', 8, { hint: 'Legs are not rounded to half days', unit: 'hours' }),
      row('Time', 'world.clock', 'info', 'The story clock', 'always on', { hint: 'Always on, not a switch: dates, deadlines, drift, the cast and the digest use it' }),
      row('Time', 'world.dueSoon', 'num', 'Due soon within', 3, { unit: 'story days' }),
      row('Time', 'world.lookAhead', 'num', 'Coming up looks ahead', 30, { hint: 'Journal › Calendar', unit: 'story days' }),
      row('Time', 'world.daysWhole', 'num', 'Days kept whole', 14, { hint: 'Older days keep a short record', unit: 'days' }),
      row('Time', 'world.daysAll', 'num', 'Days kept in all', 120, { hint: 'Older ones are dropped', unit: 'days' }),
    ]),
    sec('director', 'Rules', 'Director', 'Checks, spoilers, the pulse, one planner for arcs and the cast, names.', [
      row('Spoilers', 'director.sceneSpoilers', 'sw', 'Scene spoilers hidden by default', true, { hint: 'This scene’s wants and hiding on Now and in the dossier', tags: ['chat'] }),
      row('Spoilers', 'director.planSpoilers', 'sw', 'Plan spoilers hidden by default', true, { hint: 'Story › Director (and news on its way); per chat', tags: ['merged', 'chat'] }),
      row('World pulse', 'director.pulse', 'seg', 'Pulse', 'Lively', { options: ['Off', 'Quiet', 'Lively'] }),
      row('World pulse', 'director.pulseInvents', 'sw', 'The pulse may invent events', true, { hint: 'The narrator invents them inside the reply; no extra call', tags: ['cost'] }),
      row('Planner (arcs and the cast)', 'director.when', 'seg', 'When to plan', 'When I ask', { options: ['When I ask', 'Automatically'] }),
      row('Planner (arcs and the cast)', 'director.castRead', 'num', 'Cast moves: messages read', 3, { hint: 'The last few only; the reply waits for this call' }),
      row('The cast', 'director.unmetDie', 'sw', 'Unmet people can die off-screen', false),
    ]),
    sec('money', 'Rules', 'Money', 'Coins and prices.', [
      row('Coins', 'money.coins', 'txt', 'Coins, smallest first', '', { hint: 'Blank: the pack’s coins (Ersveil: copper, silver, gold)' }),
      row('Coins', 'money.show', 'seg', 'Show money as', 'Each coin', { options: ['Each coin', 'Smallest coin only'] }),
      row('Coins', 'money.priceScale', 'num', 'Price scale', 0, { hint: '0 keeps the pack’s prices' }),
    ]),
    sec('extras', 'Rules', 'Chat extras', 'Choices, inner chatter, your look and trackers.', [
      row('Inner chatter', 'extras.sendBack', 'sw', 'Send the last reply’s thoughts back to the story', false),
      row('Inner chatter', 'extras.chatterLines', 'num', 'Most chatter lines per reply', 3),
    ]),
    sec('models', 'Setup', 'Models', 'Three connections instead of five pickers, and the one fallback call.', [
      row('Calls', 'models.oneAtATime', 'sw', 'One call at a time per connection', true, { hint: 'A local server is never asked twice at once' }),
      row('Calls', 'models.priority', 'sw', 'Calls the reply waits on go first', true, { hint: 'Arc plans never start while a reply is being sent' }),
      row('Calls', 'models.fallback', 'sw', 'Fallback when a reply forgot its lines', true, { hint: 'One extra call, only when the whole change block is missing', tags: ['merged', 'cost'] }),
    ], 'models'),
    sec('packs', 'Setup', 'Packs and trackers', 'Content packs, data modules and your trackers.', [], 'packs'),
    sec('addons', 'Setup', 'Add-ons', 'Modules, custom views and skins from packs.', [
      row('Custom views', 'addons.customViews', 'sw', 'Allow custom views', false, { hint: 'Sandboxed pages a pack can bring; they can only ask the suite to do things' }),
    ]),
    sec('tools', 'Tools', 'Tools', 'What is sent, the budgets, prompts, Inspector, problems, diagnostics and chat data.', [
      row('Prompts', 'tools.arcPrompt', 'btn', 'Arc planner prompt', null, { hint: 'What the planner is asked', options: ['Read and edit', 'Reset to default'] }),
      row('Chat data', 'tools.rewind', 'sw', 'Rewind when a middle message is deleted', false),
    ], 'tools'),
  ];
}

const MODULE_SUBS = {
  rpg: { fightBoard: true, gearInFights: true, partyLoad: true },
  people: { stages: true, drift: false, presets: true, socialChecks: true, repeated: true },
  world: { weather: true, worldView: true, trips: true, digest: true },
  director: { checks: true, rollBefore: true, threads: true, arcPlanning: true, cast: true },
  extras: { choices: true, chatter: true, yourLook: true, trackers: true },
};

function buildModuleSet(rpg) {
  const set = {};
  for (const [id, subs] of Object.entries(MODULE_SUBS)) {
    set[id] = { on: id === 'rpg' ? rpg : true, subs: { ...subs } };
  }
  return set;
}

const CONNECTIONS = [
  { id: 'story', name: 'Story', desc: 'Follows the chat’s connection; change it in SillyTavern', choice: 'The chat’s own', readOnly: true, usedFor: ['narration', 'change lines', 'pulse ideas (inside the reply)'] },
  { id: 'quick', name: 'Quick helpers', desc: 'Short calls the reply waits for: keep this fast', choice: 'Fast helper', readOnly: false, usedFor: ['checks rolled before the reply (up to 20 s)', 'fight set-up from your attack (up to 20 s)', 'cast moves (waits up to 15 s)'] },
  { id: 'background', name: 'Background', desc: 'Calls nobody waits on; they run behind the others', choice: 'Background helper', readOnly: false, usedFor: ['new-person fill-in (with hidden notes)', 'Refresh', 'the fallback call', 'arc plans (never started while a reply is sent)'] },
];

export function buildSettings(opts = {}) {
  const rpg = opts.rpg !== false;
  return {
    sections: buildSections(),
    modules: {
      scope: 'chat',
      chat: buildModuleSet(rpg),
      newChats: buildModuleSet(true),
      preset: 'standard',
    },
    connections: CONNECTIONS.map(c => ({ ...c, usedFor: [...c.usedFor] })),
  };
}
