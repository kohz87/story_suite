// Builds the World view-model from recorded atlas.view, world.areaTier, atlas.selected and director.world answers (pure).

const DAY_MIN = 1440;
const text = v => (typeof v === 'string' ? v : '');
const list = v => (Array.isArray(v) ? v : []);
const key = v => text(v).trim().toLowerCase();

// world.areaTier tier 0-9 (SD/atlas/policy.js:69) → the three danger words; no tier (unknown place) reads as safe.
function dangerOf(tier) {
  if (!Number.isInteger(tier) || tier <= 2) return 'safe';
  return tier <= 5 ? 'risky' : 'dangerous';
}

// atlas.view places (SD/atlas/map.js:113-122); a place without coordinates cannot be drawn and is left out.
function placesOf(view, tiers) {
  return list(view?.places)
    .filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y) && text(p.id))
    .map(p => ({
      id: p.id, name: text(p.name), kind: text(p.kind), region: text(p.region) || null,
      x: p.x, y: p.y, visited: p.visited === true, here: p.here === true, danger: dangerOf(tiers?.[p.id]),
    }));
}

// The open quests that name a place (director.world quests[]), by place id; people per place wait for the people store.
function withQuests(places, world) {
  const quests = list(world?.quests).filter(q => text(q?.name) && text(q?.placeId));
  return places.map(p => ({ ...p, quests: quests.filter(q => q.placeId === p.id).map(q => text(q.name)) }));
}

// atlas.view routes (map.js:124-127): free-text kinds fold into road or track.
const routeKind = kind => (/track|trail|path/i.test(text(kind)) ? 'track' : 'road');

function routesOf(view, ids) {
  return list(view?.routes)
    .filter(r => ids.has(r?.from) && ids.has(r?.to))
    .map(r => ({ kind: routeKind(r.kind), a: r.from, b: r.to }));
}

// atlas.selected = atlas.place (SD/atlas/queries.js:78-84, 113-114): its `trip` is { fromId, fromName, km, days, unit, by, mode }.
function tripOf(selected) {
  const t = selected?.trip;
  if (!t || !text(t.fromId) || !text(selected.id)) return null;
  const minutes = Math.round((Number(t.days) || 0) * (t.unit === 'hour' ? 60 : DAY_MIN));
  const by = list(t.by).filter(Boolean).join(' / ');
  return {
    state: 'planned',
    placeIds: [t.fromId, selected.id],
    legs: [{ from: text(t.fromName), to: text(selected.name), km: Number.isFinite(t.km) ? t.km : null, minutes, note: by || null }],
    leave: null, arrive: null, mode: text(t.mode) || null,
  };
}

// chronicle stance is free text up to 80 characters (SD/chronicle/domain.js:222); unmatched words read as neutral.
function stanceOf(raw) {
  const s = key(raw);
  if (/hostile|enem|\bwar\b/.test(s)) return 'hostile';
  if (/unfriend|distrust|wary|cold/.test(s)) return 'unfriendly';
  if (/friend|allied|ally/.test(s)) return 'friendly';
  if (/warm|favou?r|kind/.test(s)) return 'warm';
  return 'neutral';
}

// The people a faction lists (director.world factions[].members); an entry without a name is left out.
const membersOf = raw => list(raw).filter(m => text(m?.name)).map(m => ({ personId: text(m.personId) || null, name: text(m.name) }));

// director.world factions (SD/world/known-parts/news.js): areaPlaceIds and members come from the answer; an older answer
// without areaPlaceIds falls back to the area's name matching a place or region.
function factionsOf(world, places) {
  return list(world?.factions).filter(f => text(f?.id)).map(f => {
    const area = key(f.area);
    const named = area ? places.filter(p => key(p.name) === area || key(p.region) === area).map(p => p.id) : [];
    const given = list(f.areaPlaceIds).filter(id => places.some(p => p.id === id));
    return { id: f.id, name: text(f.name), stance: stanceOf(f.stance), summary: text(f.summary), areaPlaceIds: given.length ? given : named, members: membersOf(f.members) };
  });
}

// The heard stamps a news item lists (where the party was, when, who told them or null); an empty one is dropped.
const heardOf = raw => list(raw).map(h => ({ where: text(h?.where), when: text(h?.when), from: text(h?.from) || null })).filter(h => h.where || h.when);

// director.world news (known-parts/news.js): '' state is an open event thread (ongoing); place and faction ids and the heard stamp come
// from the answer (an older answer falls back to name matching).
function newsOf(world, places, factions) {
  return list(world?.news).filter(n => text(n?.id)).map(n => {
    const place = places.find(p => p.id === n.placeId) ?? places.find(p => key(p.name) === key(n.place));
    const factionText = key(n.factions);
    const faction = factions.find(f => list(n.factionIds).includes(f.id)) ?? (factionText ? factions.find(f => factionText.includes(key(f.name))) : null);
    const state = ['looming', 'ongoing', 'resolved'].includes(n.state) ? n.state : n.open === false ? 'resolved' : 'ongoing';
    return {
      id: n.id, title: text(n.name), state, summary: text(n.summary),
      placeId: place?.id ?? null, factionId: faction?.id ?? null, heard: heardOf(n.heard),
    };
  });
}

/** selectWorld({ atlasView, tiers, selected, worldView }) → the world view-model; a missing answer leaves that part empty or null. */
export function selectWorld({ atlasView = null, tiers = null, selected = null, worldView = null } = {}) {
  const places = withQuests(placesOf(atlasView, tiers), worldView);
  const ids = new Set(places.map(p => p.id));
  const factions = factionsOf(worldView, places);
  return {
    places,
    routes: routesOf(atlasView, ids),
    trip: tripOf(selected),
    news: newsOf(worldView, places, factions),
    factions,
  };
}
