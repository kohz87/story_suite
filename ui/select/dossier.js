// Turns the recorded dossier, meters, ladder and notes query answers into one person's Dossier view-model (DOSSIER_SHAPE), leaving gaps null or empty.
import { showSourceTag } from '../kit/source-tag.js';

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

// "Species · gender · age"; an unstated gender reads "gender not stated" (26).
function idLineOf(dossier, genderUnknown) {
  const gender = text(dossier.gender)?.toLocaleLowerCase();
  return [text(dossier.species), genderUnknown ? 'gender not stated' : gender, text(dossier.age)].filter(Boolean).join(' · ');
}

// npc.next (packages/npc-state-delta/src/npc-meters-queries.js:47-77 (ladderView), served by npc.next :213): { rank, next: { name, needs: [{ label, at, below, met }], milestone }, risk, text }; null without a ladder.
function stageOf(next) {
  if (!isRecord(next)) return null;
  const upcoming = isRecord(next.next) ? next.next : null;
  const lacking = [
    ...(Array.isArray(upcoming?.needs) ? upcoming.needs : []).filter(need => isRecord(need) && need.met !== true && text(need.label)).map(need => `${need.label} ${need.at}`),
    ...(isRecord(upcoming?.milestone) && upcoming.milestone.met !== true && text(upcoming.milestone.name) ? [upcoming.milestone.name] : []),
  ];
  return { now: text(next.rank) ?? '', next: text(upcoming?.name), needs: lacking.length ? lacking.join(' and ') : null };
}

// npc.meters `recent` rows (eventLog, packages/npc-state-delta/src/npc-meters-pacing.js:126-128): { at, date, mv?: {axis:n} | ask?: {axis:n}, held, note?, why? }, newest first → one change per meter moved.
function changesOf(meters) {
  const rows = Array.isArray(meters?.recent) ? meters.recent.filter(isRecord) : [];
  return rows.flatMap(row => {
    const moved = isRecord(row.mv) ? row.mv : isRecord(row.ask) ? row.ask : {};
    return AXES.filter(axis => Number.isFinite(moved[axis]) && moved[axis] !== 0).map(axis => ({
      date: String(row.date ?? ''), meter: axis, delta: moved[axis], why: showSourceTag(text(row.why) ?? text(row.note) ?? ''), heldBack: row.held === true && !isRecord(row.mv),
    }));
  });
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

// Memory dates and day links are a gap (§2.4): date stays empty.
const pastOf = memories => (Array.isArray(memories) ? memories : [])
  .map(item => (isRecord(item) ? text(item.text) : text(item)))
  .filter(Boolean)
  .map(line => ({ date: '', text: showSourceTag(line), dayRef: null }));

function profileOf(dossier) {
  const aliases = strings(dossier.aliases).join(', ');
  return {
    gender: text(dossier.gender), species: text(dossier.species), age: text(dossier.age), home: text(dossier.homeBase), aliases: aliases || null,
    looks: text(dossier.appearance), personality: text(dossier.personality), speech: text(dossier.speech), background: text(dossier.background),
    // Behaviour is merged into Habits (decision 26).
    habits: [...new Set([...strings(dossier.mannerisms), ...strings(dossier.behaviorProfile)])],
    ...(likesOf(dossier).length ? { likes: likesOf(dossier) } : {}),
  };
}

/**
 * Dossier view-model from { dossier: people.dossier, meters?: npc.meters({ name }) for its `recent` rows (no store reader for them yet), next?: npc.next, cast?: the npc.cast row, portrait?: npc.portrait,
 * keyPeople?: director.keyPeople.view (place and news of someone away), party?: party.actors, moodTile?: NPC State's moodTile(npc), people?: people.list, place?: the scene's place name }; null when the dossier gave no answer.
 * `dossier` is people.dossier (the store's); `following` is the store's `followed` flag; ties link to stored people and bring their portrait; `likes` is left out when the dossier has none.
 * Gaps stay empty: thought, wearing, scene.hiding (so `scene` is null), memory dates, secret text, death when/where/reference line.
 */
export function selectDossier({ dossier, meters, next, cast, portrait, keyPeople, party, moodTile, people, place } = {}) {
  if (!isRecord(dossier)) return null;
  const key = keyOf(dossier.name);
  const away = (isRecord(keyPeople) && Array.isArray(keyPeople.people) ? keyPeople.people : []).find(row => isRecord(row) && keyOf(row.name) === key);
  const dead = dossier.lifeState === 'deceased';
  const presumed = dead && dossier.lifeStateCertainty === 'inferred';
  const gender = text(dossier.gender)?.toLocaleLowerCase();
  const genderUnknown = gender !== 'male' && gender !== 'female';
  const isHere = !dead && (dossier.present === true || (Boolean(keyOf(place)) && keyOf(dossier.location) === keyOf(place)));   // (as isHere in ./people.js)
  return {
    id: text(dossier.id) ?? key,
    name: String(dossier.name ?? ''),
    portrait: text(portrait),
    idLine: idLineOf(dossier, genderUnknown),
    life: presumed ? 'presumed' : dead ? 'deceased' : 'alive',
    genderUnknown,
    following: dossier.followed === true,
    inParty: (Array.isArray(party) ? party : []).some(row => isRecord(row) && keyOf(row.name) === key),
    meters: metersOf(dossier),
    stage: stageOf(next),
    changes: changesOf(meters),
    mood: text(dossier.mood) ?? text(cast?.mood?.word),
    ...(moodBarsOf(moodTile, cast) ? { moodBars: moodBarsOf(moodTile, cast) } : {}),
    now: isHere
      ? { where: text(dossier.location), doing: text(dossier.status), wearing: null, thought: null }
      : { lastPlace: text(away?.place) ?? text(dossier.location), lastSeen: text(away?.newsAgo), said: null },
    scene: null,
    ties: tiesOf(dossier.keyRelationships, people),
    past: pastOf(dossier.memories),
    secrets: secretsOf(cast),
    profile: profileOf(dossier),
    death: dead ? { how: text(dossier.lifeStateReason) ?? '', when: '', where: null, certainty: presumed ? 'presumed' : 'confirmed', referenceLine: '' } : null,
  };
}
