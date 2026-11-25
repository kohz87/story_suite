// Reads each companion's NPC State keepsakes for their Party sheet: a read-only list beside Equipment, never gear.

const ROWS = 12;
const NAME_MAX = 80;
const NOTE_MAX = 160;

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max).trim() : '');

// A stored keepsake is { name, description } or a plain string; nameless rows are dropped.
function rowsOf(value) {
  return (Array.isArray(value) ? value : [])
    .map(row => (typeof row === 'string'
      ? { name: clip(row, NAME_MAX), note: '' }
      : { name: clip(row?.name, NAME_MAX), note: clip(row?.description, NOTE_MAX) }))
    .filter(row => row.name)
    .slice(0, ROWS);
}

/** { [actor id]: [{ name, note }] } for every actor but the reader's own (`pcId`); `people.dossier` matches the name or an alias. A member with none is left out. */
export function partyKeepsakes(read, actors, pcId) {
  const out = {};
  for (const actor of Array.isArray(actors) ? actors : []) {
    // (an empty name would match nobody, and is never asked)
    if (!actor?.id || actor.id === pcId || !actor.name) continue;
    const rows = rowsOf(read('people.dossier', { name: actor.name })?.keepsakes);
    if (rows.length) out[actor.id] = rows;
  }
  return out;
}
