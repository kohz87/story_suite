// The People page's rows: the mock's rows tied to NPC State's settings, read into schema rows and looked up by key for a write.
import { feelRows } from './feel.js';
import { runRows } from './run.js';
import { peopleEnv } from './catalog.js';

const ALL = () => [...feelRows(), ...runRows()];

/**
 * Returns the People schema rows for the stored NPC State settings `bucket` (values as stored, else the default the page shows).
 * `answers`: { presets: the packs' meter preset records, features: the feature store's list } (the list rows' catalog and feature notes).
 */
export function peopleRows(bucket, answers = {}) {
  const b = bucket && typeof bucket === 'object' ? bucket : {};
  const env = peopleEnv(answers);
  return ALL().map(({ read, write, store, dflt, reset, view, ...rest }) => ({ ...rest, value: read(b, env), default: null, ...(view ? view(b, env) : {}) }));
}

/** Returns the row spec for a `people.*` key (with `write(value, bucket, env)` → [[bucketKey, value], ...] or null), or null. */
export function peopleSpec(key) {
  return ALL().find(r => r.key === key) ?? null;
}

/** Returns what Reset People does: [[bucketKey, default], ...] for every row that can be written. */
export function peopleResets() {
  return ALL().flatMap(r => r.reset ?? []);
}
