// Reads the scene answers from Story Block queries: one pass over the query names, plus the portrait and gear lookups the selectors need.

const SCENE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.actors', 'party.pc', 'party.levels',
  'party.terms', 'mounts.pace', 'director.goal', 'director.next', 'director.keyPeople', 'atlas.trip', 'inventory.wallet', 'inventory.currency',
  'inventory.encumbrance', 'npc.cast', 'chatter.head', 'time.overdue', 'reply.digest', 'notes.refusedAt'];

// Who is here, from the store: the present people of `people.list` as [{ id, name, meters, followed, portrait }] (the old `npc.present` answer's shape, still the
// key the selectors read); null while the chat has no people slice.
const hereOf = list => (Array.isArray(list)
  ? list.filter(row => row?.present === true && row.lifeState !== 'deceased').map(row => ({ id: row.id, name: row.name, meters: row.meters, followed: row.followed === true, portrait: row.portrait ?? null }))
  : null);

// Asks each query once; the people come from the store (`people.list`). A query that is not there is a gap (null), never an error.
export function gather(read, names = SCENE) {
  const answers = { 'npc.present': hereOf(read('people.list', {})) };
  for (const name of names) answers[name] = read(name, {});
  return answers;
}

// What the selectors need beyond the answers: the RPG is on when the party answers; portraits come one name at a time.
export function optsOf(read, answers, ctx) {
  const portraits = {};
  for (const row of answers['npc.present'] ?? []) if (row?.name) portraits[row.name] = row.portrait ?? null;
  const lead = answers['party.pc']?.name;
  const leadRow = lead ? (read('people.list', {}) ?? []).find(row => row?.name === lead) : null;
  return {
    rpg: Array.isArray(answers['party.actors']) && answers['party.actors'].length > 0,
    persona: ctx()?.name1 ?? '',
    portrait: leadRow?.portrait ?? null,
    portraits,
    fightOpen: false,
  };
}

export function gearOf(read, actors) {
  const gear = {};
  for (const actor of Array.isArray(actors) ? actors : []) if (actor?.id) gear[actor.id] = read('gear.view', { id: actor.id });
  return gear;
}
