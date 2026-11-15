// Reads the scene answers from Story Block queries: one pass over the query names, plus the portrait and gear lookups the selectors need.

const SCENE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.actors', 'party.pc', 'party.levels',
  'party.terms', 'mounts.pace', 'director.goal', 'director.next', 'director.keyPeople', 'atlas.trip', 'inventory.wallet', 'inventory.currency',
  'inventory.encumbrance', 'npc.cast', 'chatter.head', 'time.overdue', 'reply.digest', 'notes.refusedAt'];

// Asks each query once; `npc.present` carries the meters. A query that is not there is a gap (null), never an error.
export function gather(read, names = SCENE) {
  const answers = { 'npc.present': read('npc.present', { meters: true }) };
  for (const name of names) answers[name] = read(name, {});
  return answers;
}

// What the selectors need beyond the answers: the RPG is on when the party answers; portraits come one name at a time.
export function optsOf(read, answers, ctx) {
  const names = [...(answers['npc.present'] ?? []).map(row => (typeof row === 'string' ? row : row?.name))];
  const portraits = {};
  for (const name of names) if (name) portraits[name] = read('npc.portrait', { name });
  const lead = answers['party.pc']?.name;
  return {
    rpg: Array.isArray(answers['party.actors']) && answers['party.actors'].length > 0,
    persona: ctx()?.name1 ?? '',
    portrait: lead ? read('npc.portrait', { name: lead }) : null,
    portraits,
    fightOpen: false,
  };
}

export function gearOf(read, actors) {
  const gear = {};
  for (const actor of Array.isArray(actors) ? actors : []) if (actor?.id) gear[actor.id] = read('gear.view', { id: actor.id });
  return gear;
}
