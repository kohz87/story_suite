// Turns the recorded NPC, key-people and party query answers into the People view-model (PEOPLE_SHAPE), leaving gaps null or empty.

const WHERE_MAX = 40;
const FILTERS = ['all', 'party', 'followed', 'deceased', 'dormant'];
const AXES = ['trust', 'affection', 'desire', 'tension'];

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keyOf = name => String(name ?? '').trim().toLocaleLowerCase();
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : null);
const cut = (value, max) => (value && value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

// A name list answer ("npc.present" plain, or with { meters: true } as [{ name, meters }]) → [{ name, meters|null }].
function namesOf(answer) {
  if (!Array.isArray(answer)) return [];
  return answer
    .map(item => (typeof item === 'string' ? { name: item, meters: null } : isRecord(item) ? { name: item.name, meters: isRecord(item.meters) ? item.meters : null } : null))
    .filter(item => item && text(item.name))
    .map(item => ({ name: item.name.trim(), meters: item.meters }));
}

// Meters: the slice's values from npc.present, else npc.dossier's `meters`, else its `relationship`, else zeros (the contract wants numbers).
function metersOf(...sources) {
  const found = sources.find(source => isRecord(source) && AXES.some(axis => Number.isFinite(Number(source[axis]))));
  return Object.fromEntries(AXES.map(axis => [axis, Number.isFinite(Number(found?.[axis])) ? Number(found[axis]) : 0]));
}

function lookups({ keyPeople, party, cast, portraits }) {
  const away = new Map((isRecord(keyPeople) && Array.isArray(keyPeople.people) ? keyPeople.people : []).filter(isRecord).map(row => [keyOf(row.name), row]));
  const partyKeys = new Set((Array.isArray(party) ? party : []).filter(isRecord).map(row => keyOf(row.name)));
  const castBy = new Map((Array.isArray(cast) ? cast : []).filter(isRecord).map(row => [keyOf(row.name), row]));
  return { away, partyKeys, castBy, portraits: isRecord(portraits) ? portraits : {} };
}

function cardOf(item, dossier, look) {
  const key = keyOf(item.name);
  const row = look.castBy.get(key);
  const portrait = look.portraits[item.name] ?? look.portraits[key] ?? null;
  return {
    personId: text(dossier?.id) ?? text(row?.key) ?? key,
    name: text(dossier?.name) ?? item.name,
    portrait: typeof portrait === 'string' && portrait ? portrait : null,
    role: text(dossier?.role),
    followed: look.away.has(key),
    inParty: look.partyKeys.has(key),
    mood: text(dossier?.mood) ?? text(row?.mood?.word),
    meters: metersOf(item.meters, dossier?.meters, dossier?.relationship),
    where: cut(text(dossier?.location), WHERE_MAX),
  };
}

// Death card of a list row. When and where are not in npc.dossier (gap, §2.4), so they stay empty until the core answers them.
function deathOf(dossier) {
  const presumed = dossier?.lifeStateCertainty === 'inferred';
  return { how: text(dossier?.lifeStateReason) ?? '', when: '', where: null, presumed };
}

/**
 * People view-model from { present: npc.present (meters:true), known: npc.known, dossiers: { [name]: npc.dossier }, cast?: npc.cast,
 * keyPeople?: director.keyPeople.view, party?: party.actors, portraits?: { [name]: npc.portrait }, filter? }; null when npc.known gave no answer.
 * Dormant people are a gap (36.12), so notSeenLately is 0 and no card is dormant; ties are omitted (People > Map has no v2 query).
 */
export function selectPeople({ present, known, dossiers, cast, keyPeople, party, portraits, filter } = {}) {
  if (!Array.isArray(known)) return null;
  const look = lookups({ keyPeople, party, cast, portraits });
  const dossierOf = name => (isRecord(dossiers) && isRecord(dossiers[name]) ? dossiers[name] : null);
  const here = [];
  const elsewhere = [];
  const deceased = [];
  const seen = new Set();
  const everyone = [...namesOf(present), ...namesOf(known)];
  for (const item of everyone) {
    const key = keyOf(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const dossier = dossierOf(item.name);
    const card = cardOf(item, dossier, look);
    if (dossier?.lifeState === 'deceased') {
      deceased.push({ ...card, death: deathOf(dossier) });
    } else if (namesOf(present).some(p => keyOf(p.name) === key)) {
      here.push(card);
    } else {
      const kp = look.away.get(key);
      elsewhere.push({ ...card, lastPlace: cut(text(kp?.place) ?? text(dossier?.location), 80), lastSeen: text(kp?.newsAgo), said: null });
    }
  }
  const active = [...here, ...elsewhere];
  return {
    filter: FILTERS.includes(filter) ? filter : 'all',
    counts: {
      all: active.length, party: active.filter(c => c.inParty).length, followed: active.filter(c => c.followed).length,
      deceased: deceased.length, notSeenLately: 0,
    },
    here, elsewhere, notSeenLately: 0, deceased,
  };
}
