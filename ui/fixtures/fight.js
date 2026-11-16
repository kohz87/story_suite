// Builds the shared Fight fixture: the Auvoth bridge fight in each board state (offer, choose, target, ally, after, end).

export const FIGHT_STATES = Object.freeze(['offer', 'choose', 'target', 'ally', 'after', 'end']);

const NAMES = { astra: 'Astra', torka: 'Torka', rika: 'Rika', brann: 'Brann' };
const ORDER = ['Astra', 'Torka', 'Rika', 'Grey hounds', 'Brann', 'Captain'];
// Snapshots by board moment: party id -> [hp, hpMax, mp, mpMax, sp, spMax]; foe name -> [hp, max].
const SNAP = {
  offer: { astra: [12, 14, 14, 14, 12, 15], torka: [14, 14, 13, 13, 16, 16], rika: [12, 12, 12, 12, 14, 14], brann: [14, 14, 12, 12, 14, 14], foes: { 'Hound 1': 5, 'Hound 2': 5, 'Hound 3': 5, Captain: 18 } },
  choose: { astra: [11, 14, 14, 14, 9, 15], torka: [7, 14, 13, 13, 15, 16], rika: [12, 12, 12, 12, 11, 14], brann: [14, 14, 12, 12, 10, 14], foes: { 'Hound 1': 0, 'Hound 2': 5, 'Hound 3': 1, Captain: 10 } },
  after: { astra: [11, 14, 14, 14, 8, 15], torka: [7, 14, 13, 13, 14, 16], rika: [7, 12, 12, 12, 10, 14], brann: [10, 14, 12, 12, 10, 14], foes: { 'Hound 1': 0, 'Hound 2': 0, 'Hound 3': 0, Captain: 2 } },
  end: { astra: [11, 14, 14, 14, 6, 15], torka: [7, 14, 13, 13, 14, 16], rika: [7, 12, 12, 12, 9, 14], brann: [10, 14, 12, 12, 9, 14], foes: { 'Hound 1': 0, 'Hound 2': 0, 'Hound 3': 0, Captain: 0 } },
};
const SNAP_OF = { offer: 'offer', choose: 'choose', target: 'choose', ally: 'choose', after: 'after', end: 'end' };
const FOE_INFO = { Hound: { max: 5, tier: 'Minion', lv: 6, word: 'even' }, Man: { max: 11, tier: 'Standard', lv: 6, word: 'long shot' }, Captain: { max: 18, tier: 'Elite', lv: 8, word: 'long shot' } };
const PICKS = { astra: 'Iaijutsu → Hound 2', torka: 'Brute strike → Captain', rika: 'Aimed shot → Captain' };
const SKILLS = { astra: [['Iaijutsu', 3], ['Shadow Step', 3]], torka: [['Brute strike', 2]], rika: [['Aimed shot', 2], ['Fade', 3]], brann: [['Cleave', 1], ['Shield wall', 3]] };
const NARRATOR = [
  'At the Auvoth bridge, exchange 1: Astra’s iaijutsu cuts down the first hound and her follow-up misses the second. Torka’s greatsword bites into the bandit captain; Rika’s arrow goes wide. A hound nips Astra; Brann’s cleave catches the third hound. The captain slashes Torka hard.',
  'Exchange 2: Astra cuts down a second hound; Torka drives the captain back, bleeding; Rika’s shot misses. The last hound snaps at Brann and falls to his axe. Alone, the captain lashes out at all four: Brann and Rika are cut, Astra and Torka slip aside. Only the captain still stands.',
  'Exchange 3: the captain fights on; Astra’s iaijutsu brings him down. The fight at the bridge is won.',
];
const SUMMARY = ['Hound 1 down · Torka hurt (14 → 7) · the captain at 10', 'Hounds 2 and 3 down · the captain at 2 · Brann and Rika hurt', 'the captain down · won'];
// [who, what, outcome, math]
const LOG = [
  [
    ['Start', 'stances paid, 1 Stamina each', 'UPKEEP', 'Astra Shadow Step 12 → 11 · Rika Fade 14 → 13 · Brann Shield wall 14 → 13'],
    ['Astra → Hound 1', 'Iaijutsu · Hound 1 5 → 0 down', 'DECISIVE', 'd20 19 +9 = 28 vs Hound 1 d20 9 +7 = 16 · won by 12: 9 × 1.5 = 13 damage · Stamina 11 → 10'],
    ['Astra', 'tempo · extra action', 'EXTRA', 'tempo d20 15 +9 = 24 vs Hound 1 d20 12 +7 = 19 · won by 5 (3+ needed)'],
    ['Astra → Hound 2', 'Normal attack (extra) · misses', 'MISS', 'd20 3 +9 = 12 vs Hound 2 d20 10 +7 = 17'],
    ['Torka → Captain', 'Brute strike · Captain 18 → 10', 'HIT', 'd20 12 +7 = 19 vs Captain d20 6 +9 = 15 · 8 damage · Stamina 16 → 15'],
    ['Torka', 'tempo · no extra action', 'NO EXTRA', 'tempo d20 8 +7 = 15 vs Captain d20 11 +9 = 20 · needs a win by 3+'],
    ['Rika → Hound 3', 'Aimed shot · misses', 'MISS', 'd20 7 +8 = 15 vs Hound 3 d20 12 +7 = 19 · Stamina 13 → 12'],
    ['Hound 2 → Brann', 'misses', 'MISSES', 'd20 6 +7 = 13 vs Brann’s evasion d20 10 +4 = 14'],
    ['Hound 3 → Astra', 'Astra 12 → 11', 'HITS', 'd20 16 +7 = 23 vs Astra’s evasion d20 8 +9 = 17 · 2 damage − 11% soak = 1'],
    ['Brann → Grey hounds', 'Cleave · Hound 2 dodges, Hound 3 5 → 1', 'HIT 1 OF 2', 'one roll per target · vs Hound 2 miss; vs Hound 3 d20 14 +5 = 19 vs d20 7 +7 = 14: 4 damage · Stamina 13 → 11'],
    ['Brann', 'tempo · no extra action', 'NO EXTRA', 'tempo d20 9 +5 = 14 vs Hound 3 d20 10 +7 = 17 · needs a win by 3+'],
    ['Captain → Torka', 'Torka 14 → 7', 'DECISIVE', 'd20 15 +9 = 24 vs Torka’s evasion d20 7 +6 = 13 · won by 11: 6 × 1.5 = 9 − 13% soak = 7'],
  ],
  [
    ['Start', 'stances paid, 1 Stamina each', 'UPKEEP', 'Astra Shadow Step 10 → 9 · Rika Fade 12 → 11 · Brann Shield wall 11 → 10'],
    ['Astra → Hound 2', 'Iaijutsu · Hound 2 5 → 0 down', 'HIT', 'd20 14 +9 = 23 vs Hound 2 d20 11 +7 = 18 · 9 damage · Stamina 9 → 8'],
    ['Torka → Captain', 'Brute strike · Captain 10 → 2', 'HIT', 'd20 13 +7 = 20 vs Captain d20 8 +9 = 17 · 8 damage · Stamina 15 → 14'],
    ['Rika → Captain', 'Aimed shot · misses', 'MISS', 'd20 5 +8 = 13 vs Captain d20 14 +9 = 23 · Stamina 11 → 10'],
    ['Hound 3 → Brann', 'misses', 'MISSES', 'd20 8 +7 = 15 vs Brann’s evasion d20 12 +4 = 16'],
    ['Brann → Hound 3', 'Normal attack · Hound 3 1 → 0 down', 'HIT', 'd20 13 +5 = 18 vs Hound 3 d20 6 +7 = 13 · 5 damage'],
    ['Captain', 'alone when its turn comes · attacks once per standing hero', '4 ATTACKS', 'Elite, 4 heroes standing (cap 8)'],
    ['1. Captain → Astra', 'misses', 'MISSES', 'd20 9 +9 = 18 vs Astra’s evasion d20 11 +9 = 20'],
    ['2. Captain → Brann', 'Brann 14 → 10', 'HITS', 'd20 10 +9 = 19 vs Brann’s evasion d20 8 +4 = 12 · 6 damage − 22% soak = 4'],
    ['3. Captain → Rika', 'Rika 12 → 7', 'HITS', 'd20 12 +9 = 21 vs Rika’s evasion d20 13 +7 = 20 · 6 damage − 8% soak = 5'],
    ['4. Captain → Torka', 'misses', 'MISSES', 'd20 3 +9 = 12 vs Torka’s evasion d20 9 +6 = 15'],
  ],
  [
    ['Start', 'stances paid, 1 Stamina each', 'UPKEEP', 'Astra Shadow Step 8 → 7 · Rika Fade 10 → 9 · Brann Shield wall 10 → 9'],
    ['Astra → Captain', 'Iaijutsu · Captain 2 → 0 down', 'HIT', 'd20 12 +9 = 21 vs Captain d20 7 +9 = 16 · 9 damage · Stamina 7 → 6'],
  ],
];

const INIT = 'Astra d20 14 +9 = 23 · Torka d20 12 +7 = 19 · Rika d20 9 +8 = 17 · Brann d20 10 +5 = 15 · Grey hounds d20 15 +1 = 16 · Captain d20 9 +3 = 12';
// Rolls and bonuses lines: [label, text]; a null label is plain text.
const BONUS = [
  ['Turn order', `, rolled once: ${INIT}`],
  ['Astra', ': hit +9 · evasion +9 with Shadow Step · tempo +9 · soak 11%'],
  ['Torka', ': hit +7 · evasion +6 · tempo +7 · soak 13%'],
  ['Rika', ': hit +8 · evasion +7 with Fade · tempo +8 · soak 8%'],
  ['Brann', ': hit +5 · evasion +4 · tempo +5 · soak 22% with Shield wall'],
  ['Grey hounds', ': d20 +7 = 6 base + 2 (Lv 6) − 1 Minion · 2 damage · 5 health'],
  ['Bandit captain', ': d20 +9 = 6 base + 2 (Lv 8) + 1 Elite · 6 damage · 18 health'],
  [null, 'Tempo: win by 3 or more after an action lands → one extra action.'],
];

const WHO = { astra: 'Astra', torka: 'Torka', rika: 'Rika', brann: 'Brann' };
const act = (who, id, label, cost, target, damage, odds = null, pick = {}) => ({
  id, label, cost, target, damage, odds, enabled: true, pick: { choice: pick.choice ?? 'skill', args: { who, ...(pick.args ?? { skill: label }) } },
});
const flee = who => act(who, 'flee', 'Flee', 'AGI +5 against the captain’s +9', 'none', null, 'long shot', { choice: 'flee', args: {} });
const item = who => act(who, 'item', 'Use item', 'Healing draught ×3 · Antidote ×1', 'ally', 'heals 6 · ends poison', null, { choice: 'item', args: { stack: 'healing-draught' } });
const normal = (who, dmg = '5 damage · 7 if decisive') => act(who, 'normal', 'Normal attack', 'STR damage · free', 'member', dmg, null, { choice: 'attack', args: {} });
// Each member's actions (Brann's are the ones the Fight board mock shows).
const GROUPS = {
  astra: who => ({ Attack: [normal(who, '6 damage · 9 if decisive'), act(who, 'iai', 'Iaijutsu', 'DEX · 1 Stamina', 'member', '9 damage · 13 if decisive')], Magic: [], Item: [item(who)], Flee: [flee(who)] }),
  torka: who => ({ Attack: [normal(who, '7 damage · 10 if decisive'), act(who, 'brute', 'Brute strike', 'STR · 2 Stamina', 'member', '8 damage · 12 if decisive')], Magic: [], Item: [item(who)], Flee: [flee(who)] }),
  rika: who => ({ Attack: [normal(who, '4 damage · 6 if decisive'), act(who, 'aimed', 'Aimed shot', 'DEX · 2 Stamina', 'member', '7 damage · 10 if decisive')], Magic: [act(who, 'magic', 'Normal magic', 'INT damage · free', 'member', '3 damage · 4 if decisive', null, { choice: 'skill', args: { skill: 'Normal magic' } })], Item: [item(who)], Flee: [flee(who)] }),
  brann: who => ({
    Attack: [normal(who), act(who, 'heavy', 'Heavy blow', 'STR damage · 1 Stamina', 'member', '6 damage · 9 if decisive'), act(who, 'cleave', 'Cleave', 'area · STR damage · 2 Stamina', 'group', '4 damage each · 6 if decisive · one roll per target')],
    Magic: [act(who, 'magic', 'Normal magic', 'INT damage · free', 'member', '2 damage · 3 if decisive')],
    Item: [item(who)],
    Flee: [flee(who)],
  }),
};
const ACTOR = () => ({
  id: 'brann',
  stance: { name: 'Shield wall', on: true, soakOn: 22, soakOff: 17, paid: [11, 10] },
  groups: GROUPS.brann(WHO.brann),
});
// Every standing member's actions, as the scene renderer reads them (no stance: the scene hides it).
const actorsOf = party => party.filter(p => p.hp > 0).map(p => ({ id: p.actorId, groups: GROUPS[p.id](WHO[p.id]) }));

function foeGroups(snap, wide) {
  const hounds = wide ? 4 : 3;
  const groups = [['Grey hounds', 'Hound', hounds, 'Hound'], ...(wide ? [['Men in grey', 'Man', 3, 'Man']] : []), ['Bandit captain', 'Captain', 1, 'Captain']];
  return groups.map(([name, label, n, key]) => {
    const info = FOE_INFO[key];
    const members = Array.from({ length: n }, (_, i) => {
      const id = n === 1 ? label : `${label} ${i + 1}`;
      return { id, name: id, hp: snap.foes[id] ?? info.max, max: info.max };
    });
    return { id: name, name, tier: info.tier, lv: info.lv, odds: { word: info.word }, members };
  });
}

function partyStrip(snap, state) {
  const picked = ['choose', 'target', 'ally', 'after'].includes(state);
  return Object.keys(NAMES).map(id => {
    const [hp, hpMax, mp, mpMax, sp, spMax] = snap[id];
    const chosen = picked ? (state === 'after' && id === 'brann' ? 'Normal attack → Hound 3' : PICKS[id] ?? null) : null;
    return { id, actorId: `actor-${id}`, name: NAMES[id], portrait: id, hp, hpMax, mp, mpMax, sp, spMax, chosen };
  });
}

function makeEnd(snap) {
  return {
    outcome: 'won', xpEach: 45, exchanges: LOG.length,
    members: Object.keys(NAMES).map(id => ({
      id, hp: snap[id][0], hpMax: snap[id][1], practice: SKILLS[id].map(([skill, gain]) => ({ skill, gain })),
    })),
  };
}

export function fightFixture(state = 'choose', { wide = false } = {}) {
  if (!FIGHT_STATES.includes(state)) throw new Error(`unknown fight state: ${state}`);
  const snap = SNAP[SNAP_OF[state]];
  const exchange = { offer: 1, choose: 2, target: 2, ally: 2, after: 2, end: 3 }[state];
  const logged = { offer: 0, choose: 1, target: 1, ally: 1, after: 2, end: 3 }[state];
  const rolled = state !== 'offer';
  const party = partyStrip(snap, state);
  return {
    state,
    title: 'Fight · Auvoth bridge',
    subtitle: `${wide ? 'Men in grey and their hounds' : 'Grey hounds and their captain'} · Combat Rules v1`,
    exchange,
    foeGroups: foeGroups(snap, wide),
    party,
    actor: ['choose', 'target', 'ally'].includes(state) ? ACTOR() : null,
    actors: ['choose', 'target', 'ally'].includes(state) ? actorsOf(party) : [],
    order: rolled ? [...ORDER] : [],
    bonuses: rolled ? BONUS.map(([label, text]) => ({ label, text })) : null,
    log: LOG.slice(0, logged).map((rows, i) => ({
      n: i + 1, summary: SUMMARY[i], rows: rows.map(([who, what, outcome, math]) => ({ who, what, outcome, math })),
    })),
    narratorTold: logged ? NARRATOR[logged - 1] : null,
    end: state === 'end' ? makeEnd(snap) : null,
  };
}
