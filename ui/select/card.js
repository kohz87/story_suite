// Builds the character-card view-model from recorded query answers; gaps come back as null.

// answers: { [queryName]: answer } as the port read them (a missing key is a query that is not there).
// opts: { rpg: bool (the RPG is on), persona: string (the reader's name), portrait: string|null (the `npc.portrait` answer for the lead) }.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');
const orNull = value => text(value) || null;
const whole = value => (Number.isFinite(value) ? Math.round(value) : null);

// `director.time` (SD/tracker/domain.js:326) answers text "Goldwane 12, 611, 6:40 am": the last comma part is the clock.
function dateAndClock(time) {
  const full = text(time?.text);
  const at = full.lastIndexOf(', ');
  return at < 0 ? { date: '', time: full } : { date: full.slice(0, at), time: full.slice(at + 2) };
}

// `director.status` (SD/screens/queries.js:386 statusExtras) gives the place line and region; `scene.place` (SB/domains/scene.js:92) is the fallback.
function sceneOf(answers) {
  const { date, time } = dateAndClock(answers['director.time']);
  const status = isRec(answers['director.status']) ? answers['director.status'] : {};
  const place = isRec(answers['scene.place']) ? answers['scene.place'] : {};
  const weather = isRec(answers['scene.weather']) ? text(answers['scene.weather'].text) : '';
  return {
    date,
    // No query gives the weekday (the calendar has it, SD calendar.js:234): a gap.
    weekday: null,
    time,
    place: text(status.place) || text(place.name),
    region: orNull(status.region) || orNull(place.region),
    weather: orNull(status.weather) || orNull(weather),
  };
}

// `party.pc` is `{ id }` from the roster (SB/lean-rpg/roster.js:58); a party module may add name, level, className and pools {cur,max} (game-header.js:171-192).
function barsOf(lead) {
  const out = [];
  for (const kind of ['hp', 'mp', 'sp']) {
    const max = whole(lead?.[kind]?.max);
    if (max === null || max <= 0) continue;
    out.push({ kind, value: whole(lead[kind].cur) ?? 0, max });
  }
  return out.length ? out : null;
}

function levelText(answers, lead) {
  const terms = isRec(answers['party.terms']) ? answers['party.terms'] : {};
  const word = text(terms.levelName) || 'Lv';
  const levels = Array.isArray(answers['party.levels']) ? answers['party.levels'] : [];
  const mine = levels.find(row => isRec(row) && lead?.id && row.id === lead.id);
  const level = whole(lead?.level) ?? whole(mine?.level);
  return level === null ? null : `${word} ${level}`;
}

// `mounts.pace` (SB/domains/mounts.js:271 → mountsPace :98): { pace, mounts, riders, short, slowest }; short riders walk.
function paceOf(pace) {
  if (!isRec(pace) || !Number.isFinite(pace.pace)) return null;
  const short = Number.isFinite(pace.short) ? pace.short : 0;
  return { kmDay: pace.pace, by: text(pace.slowest) || 'mounts', slowed: short > 0, why: short > 0 ? `${short} on foot` : null };
}

// `inventory.encumbrance` (SB/domains/inventory/queries.js:151): { on, encumbered, load, capacity }; timed conditions and stances are a gap.
function statusesOf(answers) {
  const bag = answers['inventory.encumbrance'];
  if (!isRec(bag) || bag.on !== true || bag.encumbered !== true) return [];
  return [{ id: 'encumbered', label: 'Encumbered', note: `${bag.load} / ${bag.capacity}`, tone: 'debuff' }];
}

// `party.actors` (SB/lean-rpg/roster.js:57): [{ id, name, pc? }]; the lead is the one `party.pc` names.
function actorName(answers, lead) {
  const actors = Array.isArray(answers['party.actors']) ? answers['party.actors'] : [];
  return text(actors.find(actor => isRec(actor) && actor.id === lead?.id)?.name);
}

export function selectCard(answers = {}, opts = {}) {
  const lead = isRec(answers['party.pc']) ? answers['party.pc'] : null;
  const rpg = opts.rpg === true;
  const card = {
    rpg,
    scene: sceneOf(answers),
    you: { portrait: orNull(opts.portrait), name: text(lead?.name) || actorName(answers, lead) || text(opts.persona) },
    chips: {},
    statuses: statusesOf(answers),
  };
  if (!rpg) return card;
  card.you.levelText = levelText(answers, lead);
  card.you.className = orNull(lead?.className ?? lead?.class);
  const actors = answers['party.actors'];
  // soak % and the exp bar have no query yet (a gap: UI-PLAN §2.1).
  card.chips = {
    soakPct: null,
    party: Array.isArray(actors) ? { n: actors.length, max: 4 } : null,
    pace: paceOf(answers['mounts.pace']),
  };
  card.bars = barsOf(lead);
  card.exp = null;
  return card;
}
