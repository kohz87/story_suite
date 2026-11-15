// Real arguments for the id-taking queries, found in the chat state at one reply: each person's name, each item's
// stack and definition, each owner, each thread. Returns the calls to make and the queries that had nothing to ask about.
const asName = item => (typeof item === 'string' ? item : typeof item?.name === 'string' ? item.name : null);
const unique = list => [...new Set(list.filter(item => typeof item === 'string' && item))].sort();

function people(values, state) {
  const found = [];
  for (const key of ['npc.known', 'npc.present', 'scene.present']) {
    if (Array.isArray(values[key])) found.push(...values[key].map(asName));
  }
  if (Array.isArray(state?.domains?.scene?.present)) found.push(...state.domains.scene.present.map(asName));
  return unique(found);
}

function threadKeys(values) {
  const list = values['director.threads'];
  const items = Array.isArray(list) ? list : Array.isArray(list?.threads) ? list.threads : [];
  return unique(items.flatMap(item => [item?.key, item?.id]));
}

/** `{ calls: [{ name, args }], skipped: [{ name, reason }] }` for the parameterized queries among `queryNames`. */
export function planTargetedQueries(queryNames, values, state) {
  const inventory = state?.domains?.inventory ?? {};
  const stacks = Object.keys(inventory.stacks ?? {}).sort();
  const defs = Object.keys(inventory.defs ?? {}).sort();
  const defNames = unique(Object.values(inventory.defs ?? {}).map(def => def?.name));
  const owners = unique([...Object.values(inventory.stacks ?? {}).map(stack => stack?.owner), ...Object.keys(inventory.wallets ?? {})]);
  const named = people(values, state);
  const threads = threadKeys(values);
  const wants = {
    'npc.dossier': ['name', named], 'npc.portrait': ['name', named], 'npc.identity': ['name', named],
    'npc.meters': ['name', named], 'npc.next': ['name', named], 'npc.keyAway': ['name', named],
    'npc.socialModifier': ['name', named],
    'inventory.find': ['name', defNames], 'inventory.condition': ['stack', stacks],
    'inventory.wallet': ['owner', owners], 'inventory.items': ['owner', owners],
    'director.thread': ['key', threads],
  };
  const calls = [];
  const skipped = [];
  for (const name of queryNames) {
    const want = wants[name];
    if (!want) continue;
    const [field, targets] = want;
    if (targets.length === 0) {
      skipped.push({ name, reason: `no ${field} found in the chat state at this reply` });
      continue;
    }
    for (const target of targets) calls.push({ name, args: { [field]: target } });
  }
  if (queryNames.includes('inventory.definitions') && defs.length) calls.push({ name: 'inventory.definitions', args: { ids: defs } });
  return { calls, skipped };
}
