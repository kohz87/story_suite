// Turns the recorded dossier, meters, ladder and notes query answers into one person's Dossier view-model (DOSSIER_SHAPE), leaving gaps null or empty.

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

// "Species · gender · age"; an unknown gender reads "gender unknown" (26).
function idLineOf(dossier, genderUnknown) {
  const gender = text(dossier.gender)?.toLocaleLowerCase();
  return [text(dossier.species), genderUnknown ? 'gender unknown' : gender, text(dossier.age)].filter(Boolean).join(' · ');
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
      date: String(row.date ?? ''), meter: axis, delta: moved[axis], why: text(row.why) ?? text(row.note) ?? '', heldBack: row.held === true && !isRecord(row.mv),
    }));
  });
}

// npc.cast `opened` / `locked` (notesView, packages/npc-state-delta/src/npc-meters-queries.js:81-104). Opened secret text is a gap (§2.4), so text stays null.
function secretsOf(row) {
  const opened = Array.isArray(row?.opened) ? row.opened.filter(isRecord) : [];
  const locked = Array.isArray(row?.locked) ? row.locked.filter(isRecord) : [];
  const items = [
    ...opened.map(note => ({ open: true, title: text(note.title), rule: text(note.text), text: null })),
    ...locked.map(note => ({ open: false, title: null, rule: text(note.opens), text: null })),
  ];
  return { opened: opened.length, total: items.length, items };
}

// keyRelationships lines ("Name — their role | durable dynamic") → ties; a line without the dash is all name. Ids are not linked yet (§12.4 gap), so personId is null.
function tiesOf(lines) {
  return strings(lines).map(line => {
    const [name, ...rest] = line.split(' — ');
    return { personId: null, name: name.trim(), line: rest.join(' — ').split('|').map(part => part.trim()).filter(Boolean).join(' · ') };
  });
}

// Memory dates and day links are a gap (§2.4): date stays empty.
const pastOf = memories => (Array.isArray(memories) ? memories : [])
  .map(item => (isRecord(item) ? text(item.text) : text(item)))
  .filter(Boolean)
  .map(line => ({ date: '', text: line, dayRef: null }));

function profileOf(dossier) {
  const aliases = strings(dossier.aliases).join(', ');
  return {
    gender: text(dossier.gender), species: text(dossier.species), age: text(dossier.age), home: text(dossier.homeBase), aliases: aliases || null,
    looks: text(dossier.appearance), personality: text(dossier.personality), speech: text(dossier.speech), background: text(dossier.background),
    // Behaviour is merged into Habits (decision 26).
    habits: [...new Set([...strings(dossier.mannerisms), ...strings(dossier.behaviorProfile)])],
  };
}

/**
 * Dossier view-model from { dossier: npc.dossier, meters?: npc.meters({name}), next?: npc.next, cast?: the npc.cast row, portrait?: npc.portrait,
 * keyPeople?: director.keyPeople.view, party?: party.actors }; null when npc.dossier gave no answer.
 * Gaps stay empty: thought, wearing, scene.hiding (so `scene` is null), memory dates, secret text, death when/where/reference line.
 */
export function selectDossier({ dossier, meters, next, cast, portrait, keyPeople, party } = {}) {
  if (!isRecord(dossier)) return null;
  const key = keyOf(dossier.name);
  const away = (isRecord(keyPeople) && Array.isArray(keyPeople.people) ? keyPeople.people : []).find(row => isRecord(row) && keyOf(row.name) === key);
  const dead = dossier.lifeState === 'deceased';
  const presumed = dead && dossier.lifeStateCertainty === 'inferred';
  const gender = text(dossier.gender)?.toLocaleLowerCase();
  const genderUnknown = gender !== 'male' && gender !== 'female';
  const isHere = dossier.present === true && !dead;
  return {
    id: text(dossier.id) ?? key,
    name: String(dossier.name ?? ''),
    portrait: text(portrait),
    idLine: idLineOf(dossier, genderUnknown),
    life: presumed ? 'presumed' : dead ? 'deceased' : 'alive',
    genderUnknown,
    following: Boolean(away),
    inParty: (Array.isArray(party) ? party : []).some(row => isRecord(row) && keyOf(row.name) === key),
    meters: metersOf(dossier),
    stage: stageOf(next),
    changes: changesOf(meters),
    mood: text(dossier.mood) ?? text(cast?.mood?.word),
    now: isHere
      ? { where: text(dossier.location), doing: text(dossier.status), wearing: null, thought: null }
      : { lastPlace: text(away?.place) ?? text(dossier.location), lastSeen: text(away?.newsAgo), said: null },
    scene: null,
    ties: tiesOf(dossier.keyRelationships),
    past: pastOf(dossier.memories),
    secrets: secretsOf(cast),
    profile: profileOf(dossier),
    death: dead ? { how: text(dossier.lifeStateReason) ?? '', when: '', where: null, certainty: presumed ? 'presumed' : 'confirmed', referenceLine: '' } : null,
  };
}
