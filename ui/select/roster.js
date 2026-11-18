// Builds the People page's roster from the store's people list: each person's id and name, whether they are in the scene, and what keeps them off the list.

/** `list`: the `people.list` answer (null when the chat has no people). → { people: [{ id, name, present, dormant, deceased, followed }] }, in dossier order. */
export function selectRoster(list) {
  const rows = Array.isArray(list) ? list : [];
  return {
    people: rows.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim()).map(p => ({
      id: p.id, name: p.name.trim(), present: p.present === true, dormant: p.dormant === true, followed: p.followed === true,
      deceased: typeof p.lifeState === 'string' && /^(dead|deceased)$/i.test(p.lifeState),
    })),
  };
}
