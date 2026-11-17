// Turns the recorded fight-board snapshot, party and choice lists into the Fight view-model (FIGHT_SHAPE), leaving gaps null.

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = value => Math.max(0, Math.trunc(Number(value)) || 0);
const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const fold = value => text(value).toLowerCase().replace(/[\s-]+/gu, '');
const signed = n => (n >= 0 ? `+${n}` : String(n));
const plural = name => (!name ? '' : /s$/iu.test(name) ? name : `${name}s`);
const END = new Set(['won', 'fled', 'lost']);

// Same bonus sum as labelLine (SB lean-rpg/board/note.js:106).
const bonusOf = pc => (pc.statBonus ?? 0) + (pc.classBonus ?? 0) + (pc.rank ?? 0) + (pc.edge ?? 0);

// One round line → a log row; same facts as labelLine (note.js:105-117), split into the contract's four cells.
function rowOf(line) {
  const pc = isRecord(line.pc) ? line.pc : {}, foe = isRecord(line.foe) ? line.foe : {};
  if (line.item) return { who: text(pc.who), what: `Uses ${text(line.item)}`, outcome: 'ITEM', math: text(line.target) ? `on ${text(line.target)}` : '' };
  const skill = line.skill ? text(line.skill) : 'Attack';
  if (line.flee) return { who: text(pc.who), what: 'Flees', outcome: String(line.outcome ?? '').toUpperCase(), math: '' };
  if (line.support) return { who: text(pc.who), what: `${skill} → ${text(line.target)}`, outcome: String(line.outcome ?? '').toUpperCase(), math: '' };
  const outcome = line.kind === 'foe' && Number.isInteger(line.soaked) && line.soaked >= 0 ? 'GLANCED OFF' : String(line.outcome ?? '').toUpperCase();
  const tag = line.decisive ? `${outcome} · DECISIVE` : outcome;
  if (line.kind === 'foe') {
    const math = Number.isFinite(foe.total) && Number.isFinite(foe.die)
      ? `${text(foe.name)} d20 ${foe.die} ${signed(foe.total - foe.die)} = ${foe.total} vs ${text(pc.who)}’s defence d20 ${pc.die} ${signed(bonusOf(pc))} = ${pc.total}` : '';
    return { who: `${text(foe.name)} → ${text(pc.who)}`, what: skill === 'Attack' ? 'Attacks' : skill, outcome: tag, math };
  }
  const math = Number.isFinite(pc.die) ? `d20 ${pc.die} ${signed(bonusOf(pc))} = ${pc.total} vs ${foe.total ?? line.dc ?? '?'}` : '';
  return { who: `${text(pc.who)} → ${text(foe.name)}`, what: skill, outcome: tag, math };
}

// Foe groups from the result's board members (engine.js `boardFoes` shape, members.js:178-195) and the sheet's real foes (read.js:167).
function groupsOf(members, foes) {
  const byGroup = new Map();
  for (const member of Array.isArray(members) ? members : []) {
    if (!isRecord(member)) continue;
    const group = Number.isFinite(Number(member.group)) ? Number(member.group) : Number(member.slot);
    byGroup.set(group, [...(byGroup.get(group) ?? []), member]);
  }
  return [...byGroup].map(([group, list]) => {
    const real = (Array.isArray(foes) ? foes : []).find(foe => Number(foe?.slot) === group);
    const name = text(real?.name ?? list[0].name.replace(/ pack \d+$/u, '').replace(/ \d+$/u, ''));
    // tier and the odds word have no source until Combat Rules v1 (plan §2.3): null.
    return {
      id: String(group), arg: { group }, name, tier: null, lv: Number.isFinite(real?.level) ? real.level : 0, odds: { word: null },
      members: list.map(member => ({ id: String(member.slot), arg: { target: Number(member.slot) }, name: text(member.name), hp: whole(member.value), max: Math.max(1, whole(member.size)) })),
    };
  });
}

// Turn order names: party entries as they are, a split group once under its plural name (order.js:29 `memberOrderEntries`).
function orderOf(order, members) {
  const seen = new Set(), out = [];
  for (const item of Array.isArray(order) ? order : []) {
    if (!isRecord(item)) continue;
    const slot = Number(item.slot ?? String(item.id ?? '').replace(/^f:/u, ''));
    const member = item.party ? null : (Array.isArray(members) ? members : []).find(entry => Number(entry?.slot) === slot);
    if (member && Number.isInteger(member.group) && member.group !== slot) {
      if (seen.has(member.group)) continue;
      seen.add(member.group);
      out.push(plural(text(member.name).replace(/ pack \d+$/u, '').replace(/ \d+$/u, '')));
    } else if (text(item.name)) out.push(text(item.name));
  }
  return out;
}

const chosenText = action => {
  const what = action.kind === 'attack' ? 'Attack' : action.kind === 'flee' ? 'Flee' : action.kind === 'item' ? 'Use item' : text(action.skill);
  return `${what}${action.target ? ` → ${text(action.target)}` : ''}`;
};

// board `choices` (the board's choices) → the four action groups; an unusable choice stays, disabled.
function groupsOfChoices(choices, foeGroups, areaAll = false) {
  const groups = { Attack: [], Magic: [], Item: [], Flee: [] };
  (Array.isArray(choices) ? choices : []).forEach((choice, at) => {
    const action = isRecord(choice?.action) ? choice.action : {}, info = isRecord(choice.view) ? choice.view : {};
    const pool = info.uses === 'mana' ? 'Mana' : 'Stamina', stat = info.stat ? String(info.stat).toUpperCase() : null;
    const cost = action.kind === 'attack' ? `${stat ?? 'STR'} damage · free`
      : action.kind === 'skill' ? `${stat ? `${stat} · ` : ''}${whole(info.cost) || 1} ${pool}`
        : action.kind === 'item' ? (Array.isArray(choice.items) ? `${choice.items.length} kinds in the bag` : 'from the bag') : 'Escape';
    const group = action.kind === 'flee' ? 'Flee' : action.kind === 'item' ? 'Item' : action.kind === 'skill' && info.uses === 'mana' ? 'Magic' : 'Attack';
    const target = action.kind === 'flee' ? 'none' : action.kind === 'item' || action.support ? 'ally'
      : info.area ? (foeGroups.length > 1 && !areaAll ? 'group' : 'none') : 'member';
    const { kind, ...rest } = action;
    const args = info.area ? { ...rest, area: true } : rest; // the input this action stands for: the board's action object split back into choice and args (SB board/interaction.js `toAction`)
    groups[group].push({ id: `${action.kind}:${at}`, label: text(info.name), cost, target, damage: null, odds: null, enabled: !choice.reason, pick: { choice: String(kind ?? ''), args, ...(action.kind === 'flee' ? { alone: true } : {}) } });
  });
  return groups;
}

/**
 * Fight view-model from { snapshot (board snapshot { session, played }, view.js:72), party (readParty records, party-data.js:169),
 * foes (readFoes real foes, party-data.js:205), choices (the board's answer), view ({ chosen: [action], targeting: 'foe'|'ally'|null }),
 * awards (the pending XP and practice), place }; null when no fight is open or the board reports an error.
 */
export function selectFight({ snapshot, party, foes, choices, view, awards, place } = {}) {
  const session = snapshot?.session, result = snapshot?.played?.result;
  if (!isRecord(session) || !isRecord(result) || snapshot.played.error) return null;
  const rounds = Array.isArray(result.rounds) ? result.rounds : [], picked = Array.isArray(view?.chosen) ? view.chosen : [];
  const foeGroups = groupsOf(result.members, foes), ended = END.has(result.stop), actor = choices?.actor ?? null;
  const targeting = view?.targeting ?? null;
  const state = ended ? 'end' : targeting === 'ally' ? 'ally' : targeting ? 'target' : actor ? 'choose' : 'after';
  const members = (Array.isArray(party) ? party : []).filter(isRecord).map(person => {
    const id = fold(person.name), bar = key => ({ value: whole(person.bars?.[key]?.value), max: whole(person.bars?.[key]?.max) });
    const pick = picked.find(action => fold(action.who) === id);
    return { id, name: text(person.name), bars: { hp: bar('health'), mp: bar('mana'), sp: bar('stamina') }, chosen: pick ? chosenText(pick) : null };
  });
  const xp = Array.isArray(awards?.xp) ? awards.xp : [], practice = Array.isArray(awards?.practice) ? awards.practice : [];
  return {
    state, title: text(place) ? `Fight · ${text(place)}` : 'Fight', subtitle: null,
    exchange: whole(session.setup?.offset) + (Array.isArray(session.exchanges) ? session.exchanges.length : 0) + (ended ? 0 : 1),
    foeGroups,
    party: members.map(({ id, name, bars, chosen }) => ({ id, arg: { target: name }, actorId: id, name, portrait: null, hp: bars.hp.value, hpMax: bars.hp.max, mp: bars.mp.value, mpMax: bars.mp.max, sp: bars.sp.value, spMax: bars.sp.max, chosen })),
    actor: actor && !ended ? { id: fold(actor.who), stance: null, groups: groupsOfChoices(choices.choices, foeGroups, session.setup?.areaAll === 1) } : null,
    // The board answers for one member at a time, so only the acting member is listed (the scene renderer needs all; the kind's view gives them).
    actors: actor && !ended ? [{ id: fold(actor.who), groups: groupsOfChoices(choices.choices, foeGroups, session.setup?.areaAll === 1) }] : [],
    order: orderOf(result.order, result.members),
    bonuses: null,
    log: rounds.map(round => ({ n: whole(round.n), summary: `${(round.lines ?? []).length} rolls${round.decisive ? ' · decisive' : ''}`, rows: (round.lines ?? []).filter(isRecord).map(rowOf) })),
    narratorTold: null,
    end: ended ? {
      outcome: result.stop, xpEach: xp.length ? whole(xp[0].amount) : null, exchanges: rounds.length,
      members: members.map(person => ({ id: person.id, hp: person.bars.hp.value, hpMax: person.bars.hp.max,
        practice: practice.filter(use => fold(use.who) === person.id).map(use => ({ skill: text(use.skill), gain: whole(use.amount) })) })),
    } : null,
  };
}
