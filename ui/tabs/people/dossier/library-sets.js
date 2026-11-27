// Works out what the dossier library lists: everyone once in the order that matches play, the chips' sets, the search and the previous / next person.

// Party, then here, then followed, then the rest; the dead after all of them.
const rankOf = p => (p.life !== 'alive' ? 4 : p.inParty ? 0 : p.here ? 1 : p.following ? 2 : 3);
// (`seenTurn` only orders: it counts the engine's looks at the story, not replies, so it is never shown)
const seenOf = p => (Number.isInteger(p.seenTurn) ? p.seenTurn : -1);

/**
 * Everyone in the port's `dossier` view once (it holds each person under the id and the lower-case name): party, here, followed, then the last seen first;
 * the dead last (the most recently seen of them first). People who rank and were seen alike keep the view's order.
 */
export function libraryPeople(view) {
  const seen = new Set();
  return Object.values(view ?? {}).filter(vm => vm && typeof vm === 'object' && vm.id && !seen.has(vm.id) && seen.add(vm.id))
    .sort((a, b) => rankOf(a) - rankOf(b) || seenOf(b) - seenOf(a));
}

/** The chips' lists from the ordered people. Around: the living who are in the party, here, followed or not "not seen lately". Party, Following and All keep the dead (last). */
export function chipSets(people = []) {
  return {
    around: people.filter(p => p.life === 'alive' && (p.inParty || p.here || p.following || !p.dormant)),
    party: people.filter(p => p.inParty),
    followed: people.filter(p => p.following),
    all: [...people],
  };
}

/** The people of `list` whose name or other names hold `query` (any case); the whole list for an empty one. */
export function searchPeople(list = [], query = '') {
  const q = String(query).trim().toLocaleLowerCase();
  return q ? list.filter(p => `${p.name} ${p.profile?.aliases ?? ''}`.toLocaleLowerCase().includes(q)) : list;
}

/**
 * The id one step (`delta` 1 or -1) from `currentId` through `set`, wrapping at the ends. A person who is not in the set is stepped from their place among `people`
 * (everyone, in the same order). Null when there is nobody else to go to.
 */
export function stepPerson(people = [], set = [], currentId = null, delta = 1) {
  if (!set.length) return null;
  const at = set.findIndex(p => p.id === currentId);
  let next;
  if (at >= 0) next = set[(at + delta + set.length) % set.length];
  else {
    const place = new Map(people.map((p, i) => [p.id, i]));
    const mine = place.get(currentId) ?? -1;
    next = delta > 0 ? set.find(p => place.get(p.id) > mine) ?? set[0] : set.findLast(p => place.get(p.id) < mine) ?? set.at(-1);
  }
  return next.id === currentId ? null : next.id;
}
