// Settings fixture data beyond plain rows: module definitions, presets, the removed list, packs, trackers and the "what's sent" breakdown.

export const MODULE_DEFS = [
  { id: "rpg", name: "RPG", icon: "⚔", section: "rpg", desc: "Levels, stats, skills and gear; the Party tab, the bag’s load and fights (checks live in Director)", off: "Story only: no levels, stats or fights; the Bag, Journal, checks and the clock still run.", tokens: 520,
    subs: [
      {"key": "fightBoard", "label": "Fight board", "hint": "Choose each exchange on the board", "on": true, "tags": ["merged:D3"]},
      {"key": "gearInFights", "label": "Gear in fights", "hint": "Worn gear adds to rolls and soak", "on": true, "tags": ["merged:D18"]},
      {"key": "partyLoad", "label": "Party load", "hint": "Carrying limit and slowing down when over", "on": true},
    ] },
  { id: "people", name: "People", icon: "♥", section: "people", desc: "Dossiers, feelings, moods and secrets of everyone you meet", off: "No dossiers or feelings; the scene, the Bag, quests and the clock still run.", tokens: 820,
    subs: [
      {"key": "stagesAndMilestones", "label": "Stages and milestones", "hint": "Named stages that need feelings and a story milestone", "on": true},
      {"key": "feelingsDriftEachStoryDay", "label": "Feelings drift each story day", "hint": "Feelings ease back toward their resting value", "on": false, "needs": "the story clock"},
      {"key": "meterPresetsAndRules", "label": "Meter presets and rules", "hint": "Companion, Rival, Mentor and pack sets", "on": true, "tags": ["cost:tokens"]},
      {"key": "feelingsAddToSocialChecks", "label": "Feelings add to social checks", "hint": "Persuade or charm gets a bonus from how they feel", "on": true, "tags": ["merged:D6"], "needs": "Checks (Director)"},
      {"key": "repeatedApproachesGiveLess", "label": "Repeated approaches give less", "hint": "The same praise or gift loses force within a few days", "on": true, "needs": "the story clock"},
      {"key": "moodAndPull", "label": "Mood and pull", "hint": "Moods shift with drives and what happens", "on": true},
      {"key": "dossierNotes", "label": "Dossier notes", "hint": "What people know, lies they tell, their tastes", "on": true, "tags": ["cost:tokens"]},
      {"key": "hiddenNotesForNewPeople", "label": "Hidden notes for new people", "hint": "Secrets that open with trust or events; written inside the new-person fill-in call, no call of their own", "on": true, "tags": ["cost:tokens"]},
      {"key": "tiesMap", "label": "Ties map", "hint": "Who is close to whom", "on": true},
    ] },
  { id: "world", name: "World and time", icon: "◍", section: "world", desc: "Calendar, weather, map and travel. The story clock is core and always runs", off: "The story clock, dates and deadlines still run; weather, the map, trips and the day digest stop.", tokens: 310,
    subs: [
      {"key": "weather", "label": "Weather", "hint": "Rolled from the calendar and region", "on": true, "tags": ["merged:D7"]},
      {"key": "worldViewAndMap", "label": "World view and map", "hint": "The World tab: map, news, factions", "on": true},
      {"key": "tripsAndTravel", "label": "Trips and travel", "hint": "Routes, legs and arrivals at the party pace", "on": true, "needs": "the story clock"},
      {"key": "dayDigest", "label": "Day digest", "hint": "One summary per story day for the Journal", "on": true, "needs": "the story clock"},
    ] },
  { id: "director", name: "Director", icon: "🎬", section: "director", desc: "Checks, the story’s plan and the world that moves off-screen", off: "No checks, plan or off-screen cast; the clock, World and the Journal still run.", tokens: 640,
    subs: [
      {"key": "checks", "label": "Checks", "hint": "The story asks for a roll; one owner for checks (also in Story-only chats)", "on": true, "tags": ["merged:D1"]},
      {"key": "rollChecksBeforeTheReply", "label": "Roll checks before the reply", "hint": "When you try something risky the check is rolled first", "on": true, "tags": ["cost:model call"], "needs": "Checks"},
      {"key": "worldBuildingThreads", "label": "World-building threads", "hint": "Agendas, events, clocks, beats, secrets", "on": true, "tags": ["cost:tokens"]},
      {"key": "arcPlanning", "label": "Arc planning", "hint": "A planner suggests the next arc for you to accept", "on": true, "tags": ["cost:model call"], "needs": "World-building threads"},
      {"key": "theCast", "label": "The cast", "hint": "The pack’s people live off-screen", "on": true, "tags": ["cost:model call"], "needs": "the story clock"},
      {"key": "worldPulse", "label": "World pulse", "hint": "A small roll before each reply", "on": true},
      {"key": "peopleTakeTheInitiative", "label": "People take the initiative", "hint": "Someone present acts on their own now and then", "on": true, "needs": "the story clock"},
      {"key": "names", "label": "Names", "hint": "Fresh names for new people", "on": true},
    ] },
  { id: "extras", name: "Chat extras", icon: "✦", section: "extras", desc: "Small things around each reply", off: "Replies read as plain text; the rest of the suite is unchanged.", tokens: 180,
    subs: [
      {"key": "choices", "label": "Choices", "hint": "Suggested next actions under the reply", "on": true},
      {"key": "innerChatter", "label": "Inner chatter", "hint": "Thoughts of the people present", "on": true},
      {"key": "yourLook", "label": "Your look", "hint": "The story keeps your outfit and what you carry", "on": true},
      {"key": "trackers", "label": "Trackers", "hint": "Your custom blocks (Story › Trackers)", "on": true},
    ] },
];

export const PRESETS = [
  { id: 'lean', name: 'Lean', desc: 'Inventory, money, place, people, quests and time. No world-building threads or travel.', tokens: 2460 },
  { id: 'standard', name: 'Standard', desc: 'Today’s defaults.', tokens: 3550 },
  { id: 'full', name: 'Full', desc: 'Standard plus choices, inner chatter and a check roll before each reply.', tokens: 3650 },
];

export const REMOVED = ["Save points and Return in time (restart from a message instead)", "Pick what you take (the story writes what you find)", "Key people (the ★ Follow star in People)", "Mounts list (riding animals in Mount slots, carts and boats in Bag › Transport)", "Tab placement (the tabs are fixed)", "Status strip above the message box (the inline row under the reply)", "People’s floating launcher buttons", "Auto scan, Full scan every turn, Scan every (Refresh every N)", "The People calendar (one calendar)", "Source of truth switches (one store)"];

const PACKS = {
  packs: [{ name: 'Ersveil (open world) 2.9.6', desc: '320 places · 350 routes · 135 events · 12 cast · 4 coins · a calendar · 84 weather tables · 3 data modules', on: true }],
  modules: [
    { name: 'Court favour', desc: 'Highmark’s succession · no screen; shows as Ripples', on: true },
    { name: 'Standing and fame', desc: 'by region and faction', on: true },
    { name: 'Guild membership', desc: 'ranks and dues', on: false },
  ],
  trackers: { cap: 8, items: [{ name: 'Chapel debt', desc: '3 fields · shown on Now' }, { name: 'Ship’s stores', desc: '3 fields' }] },
};

const SENT = {
  budget: [
    { name: 'Rules (fixed)', used: 3650, cap: 4000, color: '#5aa0ff' },
    { name: 'Notes this reply', used: 551, cap: 1500, color: '#f0b84a' },
    { name: 'People', used: 820, cap: 4000, color: '#ff7aa8' },
    { name: 'Director', used: 410, cap: 500, color: '#c08aff' },
    { name: 'Chat history', used: 3016, cap: null, color: 'var(--su-soft)' },
  ],
  text: [
    '[Story Suite · Goldwane 13, Fourthday, 9:30 am · Guild Office, Bluewatch · cold drizzle]',
    'Present: Sister Temiwa (wary hope; by the notice board…) · Torka (restless…) · Brann · Oyla',
    'Trip: Bluewatch → Auvoth, on foot 20 km/day, leg 1 of 3, arrive around 2:30 pm',
    'Quest in focus: Missing boatman · next: reach Auvoth and ask at the docks',
    '…',
  ].join('\n'),
  tools: [
    { label: 'Inspector', hint: 'Every change of a reply: lines, what code did, the state after; older and newer replies', button: 'Open' },
    { label: 'Problems', hint: '1 this reply: a feeling over the cap', button: 'Show' },
  ],
};

export const PANELS = { packs: PACKS, sent: SENT };
