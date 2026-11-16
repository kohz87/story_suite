// Query steps shared by the per-reply recording and the history-operation recording.
import { planTargetedQueries } from './query-args.mjs';
import { toJson } from './state-hash.mjs';

const QUERY_PREFIXES = ['scene.', 'inventory.', 'director.', 'npc.'];

export function discoverQueries(registry) {
  const names = new Set();
  for (const mod of registry?.modules?.() ?? []) {
    for (const name of Object.keys(mod?.queries ?? {})) {
      if (QUERY_PREFIXES.some(prefix => name.startsWith(prefix))) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

export function runQueriesAt(host, queryNames, index) {
  const values = {};
  const skipped = [];
  for (const name of queryNames) {
    try {
      values[name] = toJson(host.sdk.query(name, { asOf: index }));
    } catch (err) {
      skipped.push({ name, reason: String(err?.message ?? err) });
    }
  }
  const plan = planTargetedQueries(queryNames, values, host.store.at(index));
  const targeted = {};
  for (const { name, args } of plan.calls) {
    const label = `${name} ${JSON.stringify(args)}`;
    try {
      targeted[label] = toJson(host.sdk.query(name, { ...args, asOf: index }));
    } catch (err) {
      skipped.push({ name: label, reason: String(err?.message ?? err) });
    }
  }
  return { values, targeted, skipped: [...skipped, ...plan.skipped] };
}
