// Holds the fight picks made so far for the open exchange (one per standing member, asked in order), keyed by interaction id, step count and who fights whom.

let held = { key: '', list: [] };
// An edited Re-read can change who fights or who is a foe without changing the step count, so the key names both.
const keyOf = vm => `${vm.id}:${vm.steps}:${(vm.view?.actors ?? []).map(a => a.id).join(',')}:${(vm.view?.foeGroups ?? []).flatMap(g => g.members.map(m => m.id)).join(',')}`;

/** The picks held for this exchange, as `[{ actor, input: { actor, choice, args }, text }]`; stale ones (another exchange, a member no longer asked) are dropped. */
export function heldFor(vm, actors) {
  const key = keyOf(vm);
  if (held.key !== key) held = { key, list: [] };
  let at = 0;
  while (at < held.list.length && at < actors.length && held.list[at].actor === actors[at].id) at += 1;
  if (at < held.list.length) held.list = held.list.slice(0, at);
  return held.list.slice();
}

/** Holds one more pick for this exchange. */
export function holdPick(vm, entry) {
  if (held.key !== keyOf(vm)) held = { key: keyOf(vm), list: [] };
  held.list = [...held.list, entry];
}

/** Takes the last pick back (the Back button); returns true when there was one. */
export function undoPick(vm) {
  if (held.key !== keyOf(vm) || !held.list.length) return false;
  held.list = held.list.slice(0, -1);
  return true;
}

/** The staged step's inputs, one per held pick, in the order the members were asked. */
export const inputsOf = list => list.map(entry => structuredClone(entry.input));
