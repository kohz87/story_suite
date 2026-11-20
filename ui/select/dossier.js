// Turns the recorded dossier, meters, ladder and notes query answers into one person's Dossier view-model (DOSSIER_SHAPE), leaving gaps null or empty.
import { showSourceTag } from '../kit/source-tag.js';
import { isHere as isHereIn } from './people.js';
import { normalizeName } from '../../modules/people/core/core-text-parts/clean.js';

const AXES = ['trust', 'affection', 'desire', 'tension'];

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keyOf = name => String(name ?? '').trim().toLocaleLowerCase();
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : null);
const strings = value => (Array.isArray(value) ? value.map(item => text(item)).filter(Boolean) : []);

// Meters: npc.dossier's slice `meters`, else its `relationship`, else zeros (the contract wants numbers).
function metersOf(dossier) {
  const found = [dossier.meters, dossier.relationship].find(source => isRecord(source) && AXES.some(axis => Number.isFinite(Number(source[axis]))));
  return Object.fromEntries(AXES.map(axis => [axis, Number.isFinite(Number(found?.[axis])) ? Number(found[axis]) : 0]));
}

// Mood meters on the -3..+3 scale: NPC State's moodTile rows ({ key: v|a|d, value }) first, else the cast row's mood numbers (valence / energy / control).
// Absent (undefined) unless all three are whole numbers within -3..+3, so a person without mood numbers shows no bars.
function moodBarsOf(tile, cast) {
  const rows = Array.isArray(tile?.rows) ? tile.rows.filter(isRecord) : [];
  const fromRows = key => rows.find(row => row.key === key)?.value;
  const mood = isRecord(cast?.mood) ? cast.mood : {};
  const tileKnown = isRecord(tile) && tile.known !== false && rows.length > 0;
  const raw = tileKnown ? [fromRows('v'), fromRows('a'), fromRows('d')] : [mood.valence, mood.energy, mood.control];
  const ok = raw.every(value => typeof value === 'number' && Number.isInteger(value) && value >= -3 && value <= 3);
  return ok ? { feeling: raw[0], energy: raw[1], control: raw[2] } : undefined;
}

// "Species · gender · age", only what is stated; an unstated gender is flagged by the hero itself (genderUnknown), so it is not worded here too (F8).
function idLineOf(dossier, genderUnknown) {
  const gender = text(dossier.gender)?.toLocaleLowerCase();
  return [text(dossier.species), genderUnknown ? null : gender, text(dossier.age)].filter(Boolean).join(' · ');
}

// The reader's own feelings beyond the four (Settings › People › Add a meter, presets): from the cast row's bars (label, range, words, stage), else from the dossier's meter numbers.
// Absent (undefined) when there are none, so a person with only the four reads as before (F21).
function extraMetersOf(dossier, cast) {
  const bars = (Array.isArray(cast?.bars) ? cast.bars : []).filter(bar => isRecord(bar) && text(bar.id) && !AXES.includes(bar.id) && Number.isFinite(bar.value));
  const rows = bars.length ? bars.map(bar => ({
    key: bar.id, label: text(bar.label) ?? bar.id, value: bar.value, min: Number.isFinite(bar.min) ? bar.min : -100, max: Number.isFinite(bar.max) ? bar.max : 100,
    ...(text(bar.stage) ? { stage: text(bar.stage) } : {}),
  })) : Object.entries(isRecord(dossier.meters) ? dossier.meters : {}).filter(([key, value]) => !AXES.includes(key) && Number.isFinite(value)).map(([key, value]) => ({
    key, label: key[0].toLocaleUpperCase() + key.slice(1), value, min: -100, max: 100, ...(text(dossier.stages?.[key]) ? { stage: text(dossier.stages[key]) } : {}),
  }));
  return rows.length ? rows : undefined;
}

// A stage word for each of the four built-in feelings that has one: the cast row's bars, else the dossier's `stages` (F25). Undefined when none.
function axisStagesOf(dossier, cast) {
  const fromBars = Object.fromEntries((Array.isArray(cast?.bars) ? cast.bars : []).filter(bar => isRecord(bar) && AXES.includes(bar.id) && text(bar.stage)).map(bar => [bar.id, text(bar.stage)]));
  const fromDossier = Object.fromEntries(AXES.filter(axis => text(dossier.stages?.[axis])).map(axis => [axis, text(dossier.stages[axis])]));
  const found = { ...fromDossier, ...fromBars };
  return Object.keys(found).length ? found : undefined;
}

// npc.next (packages/npc-state-delta/src/npc-meters-queries.js:47-77 (ladderView), served by npc.next :213): { rank, next: { name, needs: [{ label, at, below, met }], milestone }, risk, text }; null without a ladder.
function stageOf(next, castRank) {
  if (!isRecord(next)) return text(castRank) ? { now: text(castRank), next: null, needs: null } : null;
  const upcoming = isRecord(next.next) ? next.next : null;
  const lacking = [
    ...(Array.isArray(upcoming?.needs) ? upcoming.needs : []).filter(need => isRecord(need) && need.met !== true && text(need.label)).map(need => `${need.label} ${need.at}`),
    ...(isRecord(upcoming?.milestone) && upcoming.milestone.met !== true && text(upcoming.milestone.name) ? [upcoming.milestone.name] : []),
  ];
  return { now: text(next.rank) ?? text(castRank) ?? '', next: text(upcoming?.name), needs: lacking.length ? lacking.join(' and ') : null };
}

// npc.meters `recent` rows (eventLog, modules/people/meters/npc-meters-pacing-parts/event-log.js): { at, n?, date, mv?: {axis:n} | ask?: {axis:n}, held, note?, why? }, newest first → one change per meter moved.
// `reply` is the row's message index `n` (left out when the row has none); `note` is why a held-back move moved less (the day's allowance).
function changesOf(meters) {
  const rows = Array.isArray(meters?.recent) ? meters.recent.filter(isRecord) : [];
  return rows.flatMap(row => {
    const moved = isRecord(row.mv) ? row.mv : isRecord(row.ask) ? row.ask : {};
    const heldBack = row.held === true && !isRecord(row.mv);
    return AXES.filter(axis => Number.isFinite(moved[axis]) && moved[axis] !== 0).map(axis => ({
      date: String(row.date ?? ''), meter: axis, delta: moved[axis], why: showSourceTag(text(row.why) ?? text(row.note) ?? ''), heldBack,
      ...(Number.isInteger(row.n) && row.n >= 0 ? { reply: row.n } : {}),
      ...(heldBack && text(row.note) && text(row.why) ? { note: showSourceTag(text(row.note)) } : {}),
    }));
  });
}

// NPC State's mood history (npc.cast row `mood.log`, modules/people/meters/npc-mood-parts/log.js): { n, date, v?, a?, d?, why }, newest first → the reply, date, moves and reason.
const MOOD_AXES = [['v', 'feeling'], ['a', 'energy'], ['d', 'control']];
function moodChangesOf(cast) {
  const log = Array.isArray(cast?.mood?.log) ? cast.mood.log.filter(isRecord) : [];
  const rows = log.map(row => ({
    reply: Number.isInteger(row.n) && row.n >= 0 ? row.n : null, date: String(row.date ?? ''),
    moves: MOOD_AXES.filter(([key]) => Number.isInteger(row[key]) && row[key] !== 0).map(([key, axis]) => ({ axis, delta: row[key] })), why: showSourceTag(text(row.why) ?? ''),
  })).filter(row => row.moves.length);
  return rows.length ? rows : undefined;
}

// The reply of their last recorded change: the highest message index among the memory stamps, the field changes, the meter rows and the mood history.
// (people.list's lastSeenTurn counts scans, not replies, so it is never shown as a reply.) Undefined when nothing recorded one.
function lastReplyOf(dossier, meters, cast) {
  const stamps = isRecord(dossier.memoryStamps) ? Object.values(dossier.memoryStamps).filter(isRecord).map(stamp => stamp.m) : [];
  const fields = isRecord(dossier.fieldChangeMessages) ? Object.values(dossier.fieldChangeMessages) : [];
  const recent = (Array.isArray(meters?.recent) ? meters.recent : []).filter(isRecord).map(row => row.n);
  const moods = (Array.isArray(cast?.mood?.log) ? cast.mood.log : []).filter(isRecord).map(row => row.n);
  const all = [...stamps, ...fields, ...recent, ...moods].filter(n => Number.isInteger(n) && n >= 0);
  return all.length ? Math.max(...all) : undefined;
}

// npc.cast `opened` / `locked` (notesView, packages/npc-state-delta/src/npc-meters-queries.js:81-104). Opened secret text is a gap (§2.4), so text stays null.
// Stays on NPC State's query for now (P7): the store's secret rules lose their `at` (the people view strips the key `at` as volatile), so "Opens at Trust 60" cannot be made from the store.
function secretsOf(row) {
  const opened = Array.isArray(row?.opened) ? row.opened.filter(isRecord) : [];
  const locked = Array.isArray(row?.locked) ? row.locked.filter(isRecord) : [];
  const items = [
    ...opened.map(note => ({ open: true, title: text(note.title), rule: text(note.text), text: null })),
    ...locked.map(note => ({ open: false, title: null, rule: text(note.opens), text: null })),
  ];
  return { opened: opened.length, total: items.length, items };
}

// keyRelationships lines ("Name — their role | durable dynamic") → ties; a line without the dash is all name. A name (or alias) that is a stored person links
// to them (personId) and brings their portrait; anyone else stays plain text with no portrait key.
function tiesOf(lines, people) {
  const byName = new Map();
  for (const row of Array.isArray(people) ? people.filter(isRecord) : []) for (const label of [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]) if (keyOf(label) && !byName.has(keyOf(label))) byName.set(keyOf(label), row);
  return strings(lines).map(line => {
    const [name, ...rest] = line.split(' — ');
    const who = byName.get(keyOf(name));
    return {
      personId: who?.id ?? null, name: name.trim(), line: rest.join(' — ').split('|').map(part => part.trim()).filter(Boolean).join(' · '),
      ...(who?.portrait ? { portrait: who.portrait } : {}),
    };
  });
}

// What the person likes: the dossier's `likes` list, else its custom field "Likes" split at commas, semicolons or line breaks; empty when neither is there.
function likesOf(dossier) {
  if (Array.isArray(dossier.likes)) return strings(dossier.likes);
  const fields = isRecord(dossier.customFields) ? dossier.customFields : {};
  const label = Object.keys(fields).find(name => keyOf(name) === 'likes');
  return label && typeof fields[label] === 'string' ? fields[label].split(/[,;\n]/).map(part => part.trim()).filter(Boolean) : [];
}

// The memories newest first (the stored list runs oldest to newest), each with its story date and reply from NPC State's memory stamps
// ({ normalized text: { m: message index, d?: story date text } }, modules/people/core/core-record-shared-parts/memories.js). A memory without a stamp has no date (never guessed).
// The day link is the stamp's date text (the Journal finds that day).
function pastOf(memories, stamps) {
  const byKey = isRecord(stamps) ? stamps : {};
  return (Array.isArray(memories) ? memories : [])
    .map(item => (isRecord(item) ? text(item.text) : text(item)))
    .filter(Boolean)
    .map((line) => {
      const stamp = isRecord(byKey[normalizeName(line)]) ? byKey[normalizeName(line)] : null;
      const reply = Number.isInteger(stamp?.m) && stamp.m >= 0 ? stamp.m : null;
      const date = reply !== null ? text(stamp.d) : null;
      return { date: date ?? '', text: showSourceTag(line), dayRef: date, ...(reply !== null ? { reply } : {}) };
    })
    .reverse();
}

// What the notes feature holds of them (cast row `notes`): tastes as "likes x" / "dislikes y" rows and what they know, as far as the story has told it (a hidden fact has no words).
function notesOf(notes) {
  if (!isRecord(notes)) return {};
  const tastes = (Array.isArray(notes.tastes) ? notes.tastes : []).filter(isRecord).map(row => [(row.sign === '-' || row.sign === 'dislikes') ? 'Dislikes' : 'Likes', text(row.item)]).filter(([, item]) => item);
  const knows = (Array.isArray(notes.knows) ? notes.knows : []).filter(row => isRecord(row) && !row.hidden).map(row => text(row.text)).filter(Boolean);
  return { ...(tastes.length ? { tastes } : {}), ...(knows.length ? { knows } : {}) };
}

function profileOf(dossier, notes) {
  const aliases = strings(dossier.aliases).join(', ');
  return {
    gender: text(dossier.gender), species: text(dossier.species), age: text(dossier.age), home: text(dossier.homeBase), aliases: aliases || null,
    looks: text(dossier.appearance), personality: text(dossier.personality), speech: text(dossier.speech), background: text(dossier.background),
    // Behaviour is merged into Habits (decision 26).
    habits: [...new Set([...strings(dossier.mannerisms), ...strings(dossier.behaviorProfile)])],
    ...(likesOf(dossier).length ? { likes: likesOf(dossier) } : {}),
    // What NPC State holds beside the profile (SFF4 #7): the Level, the goal, and the abilities and keepsakes as [name, one line] rows.
    role: text(dossier.role), ...notesOf(notes),
    level: text(String(dossier.level ?? '')), goal: text(dossier.goal), abilities: namedRows(dossier.abilities), keepsakes: namedRows(dossier.keepsakes),
  };
}

// [{ name, description }] → [[name, description]], nameless rows dropped.
const namedRows = value => (Array.isArray(value) ? value : []).filter(isRecord).map(row => [text(row.name), text(row.description) ?? '—']).filter(([name]) => name);

// The engine's "Add to party" card (rpg.partyAdd: { name, soul, best, card }) → what the dossier draws: the card's title, rows and buttons, with each button's command or screen as the card gives it. Null without one.
function partyAddOf(answer) {
  const card = isRecord(answer) && isRecord(answer.card) ? answer.card : null;
  if (!card || !Array.isArray(card.actions)) return null;
  const action = item => ({ id: String(item.id), label: String(item.label), ...(item.primary ? { primary: true } : {}), ...(item.command ? { command: String(item.command) } : {}), ...(item.open ? { open: String(item.open) } : {}), payload: item.payload ?? {} });
  return { title: String(card.title ?? ''), rows: (Array.isArray(card.rows) ? card.rows : []).map(row => ({ text: String(row?.text ?? '') })), actions: card.actions.filter(isRecord).map(action) };
}

/**
 * Dossier view-model from { dossier: people.dossier, meters?: npc.meters({ name }) for its `recent` rows (no store reader for them yet), next?: npc.next, cast?: the npc.cast row, portrait?: npc.portrait,
 * away?: director.away.view (news and return date of someone away), party?: party.actors, join?: rpg.partyAdd, moodTile?: NPC State's moodTile(npc), people?: people.list, place?: the scene's place name }; null when the dossier gave no answer.
 * `dossier` is people.dossier (the store's); `following` is the store's `followed` flag; ties link to stored people and bring their portrait; `likes` is left out when the dossier has none.
 * Gaps stay empty: thought, wearing, scene.hiding (so `scene` is null), dates of memories without a stamp, secret text, death when/where/reference line.
 */
export function selectDossier({ dossier, meters, next, cast, portrait, away: awayView, party, join, moodTile, people, place, present } = {}) {
  if (!isRecord(dossier)) return null;
  const key = keyOf(dossier.name);
  const away = (isRecord(awayView) && Array.isArray(awayView.people) ? awayView.people : []).find(row => isRecord(row) && keyOf(row.name) === key);
  const dead = dossier.lifeState === 'deceased';
  const presumed = dead && dossier.lifeStateCertainty === 'inferred';
  const gender = text(dossier.gender)?.toLocaleLowerCase();
  const genderUnknown = gender !== 'male' && gender !== 'female';
  const isHere = isHereIn(dossier, place, present);   // (the one rule, ./people.js)
  return {
    id: text(dossier.id) ?? key,
    name: String(dossier.name ?? ''),
    portrait: text(portrait),
    idLine: idLineOf(dossier, genderUnknown),
    life: presumed ? 'presumed' : dead ? 'deceased' : 'alive',
    genderUnknown,
    following: dossier.followed === true,
    inParty: (Array.isArray(party) ? party : []).some(row => isRecord(row) && keyOf(row.name) === key),
    // (the join card is offered to the living who are not in the party; the engine's answer holds the rest: RPG on, not You, room, a person the party does not know)
    partyAdd: !dead && !(Array.isArray(party) ? party : []).some(row => isRecord(row) && keyOf(row.name) === key) ? partyAddOf(join) : null,
    meters: metersOf(dossier),
    stage: stageOf(next, cast?.rank),
    ...(extraMetersOf(dossier, cast) ? { extraMeters: extraMetersOf(dossier, cast) } : {}),
    ...(axisStagesOf(dossier, cast) ? { axisStages: axisStagesOf(dossier, cast) } : {}),
    changes: changesOf(meters),
    // (who the reader is to them, in NPC State's words: the narrator's "toward the player"; owner, 20 Nov: the dossier no longer showed it)
    toward: text(dossier.relationshipSummary),
    mood: text(dossier.mood) ?? text(cast?.mood?.word),
    ...(moodBarsOf(moodTile, cast) ? { moodBars: moodBarsOf(moodTile, cast) } : {}),
    ...(moodChangesOf(cast) ? { moodChanges: moodChangesOf(cast) } : {}),
    ...(lastReplyOf(dossier, meters, cast) !== undefined ? { lastReply: lastReplyOf(dossier, meters, cast) } : {}),
    now: isHere
      ? { where: text(dossier.location), doing: text(dossier.status), wearing: null, thought: null }
      : { lastPlace: text(dossier.location), lastSeen: text(away?.newsAgo), said: null },
    scene: isHere && text(dossier.goal) ? { wants: text(dossier.goal), hiding: null } : null,
    ties: tiesOf(dossier.keyRelationships, people),
    past: pastOf(dossier.memories, dossier.memoryStamps),
    secrets: secretsOf(cast),
    profile: profileOf(dossier, cast?.notes),
    death: dead ? { how: text(dossier.lifeStateReason) ?? '', when: '', where: null, certainty: presumed ? 'presumed' : 'confirmed', referenceLine: '' } : null,
  };
}
