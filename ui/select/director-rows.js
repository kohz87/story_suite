// The Director settings page's rows (mock v7, Settings › Director): which real setting each row is, in what group, with the mock's words.
// A row is { key (the view key), module, field (the key in that module's settings), group, label, hint?, unit?, tags?, labels? ({ stored value: shown label }) }.

const G = { checks: 'Checks', spoilers: 'Spoilers', pulse: 'World pulse', planner: 'Planner (arcs and the cast)', cast: 'The cast', names: 'Names and initiative' };
const D = 'story-director';
const N = 'npc-state-delta';
const row = (group, key, module, field, label, extra = {}) => ({ group, key: `director.${key}`, module, field, label, ...extra });

export const DIRECTOR_ROWS = Object.freeze([
  row(G.checks, 'defaultDc', D, 'checks.defaultDc', 'Difficulty when none is written'),
  row(G.checks, 'socialScale', N, 'socialScale', 'Feelings in social checks: strength', { unit: '%', tags: ['merged:D6'] }),
  row(G.checks, 'socialCap', N, 'socialCap', 'Feelings in social checks: most a check moves'),
  row(G.spoilers, 'hideBehind', D, 'screens.hideBehind', 'Plan spoilers hidden by default', { hint: 'Agendas, planned beats, clocks and secrets stay hidden on Story › Director until you show them', tags: ['merged:D12'] }),
  row(G.pulse, 'pulse', D, 'pulse.mode', 'Pulse', { labels: { off: 'Off', quiet: 'Quiet', lively: 'Lively' } }),
  row(G.pulse, 'pulseInvents', D, 'pulse.invents', 'The pulse may invent events', { hint: 'The narrator invents them inside the reply; no extra call', tags: ['cost:tokens'] }),
  row(G.pulse, 'showUnderReply', D, 'pulse.showUnderReply', 'Show the roll under replies'),
  row(G.planner, 'when', D, 'arc.trigger', 'When to plan', { hint: 'Automatic plans when threads run low or the story stalls', labels: { manual: 'When I ask', auto: 'Automatically' } }),
  row(G.planner, 'autoAccept', D, 'arc.autoAccept', 'Accept plans automatically'),
  row(G.planner, 'genre', D, 'arc.genre', 'Genre and tone'),
  row(G.planner, 'recent', D, 'arc.recent', 'Arc plans: messages read'),
  row(G.planner, 'maxTokens', D, 'arc.maxTokens', 'Arc plans: longest plan', { unit: 'tokens' }),
  row(G.planner, 'stallDays', D, 'arc.stallDays', 'Stalled after', { unit: 'story days without a beat' }),
  row(G.planner, 'lowThreads', D, 'arc.lowThreads', 'Running low below', { hint: 'open threads (0: never)' }),
  row(G.planner, 'note', D, 'arc.note', 'Director’s note for the next plan'),
  row(G.planner, 'keepNote', D, 'arc.keepNote', 'Keep the note for every plan'),
  row(G.cast, 'faces', D, 'cast.faces', 'New faces at most', { labels: { day1: '1 a day', day2: '2 a day', week1: '1 a week' } }),
  row(G.cast, 'unmetDie', D, 'cast.unmetDie', 'Unmet people can die off-screen'),
  row(G.names, 'banned', D, 'names.banned', 'Banned names'),
  row(G.names, 'suggestions', D, 'names.suggestions', 'Name suggestions per new person'),
  row(G.names, 'cooldown', D, 'tracker.initiativeCooldown', 'Replies before the same person acts again'),
  row(G.names, 'elsewhere', D, 'tracker.elsewhere', 'Threads elsewhere named to the narrator', { tags: ['cost:tokens'] }),
]);
