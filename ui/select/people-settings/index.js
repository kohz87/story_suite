// The People page's rows: the mock's rows tied to NPC State's settings, read into schema rows and looked up by key for a write.
import { feelRows } from './feel.js';
import { runRows } from './run.js';

const ALL = () => [...feelRows(), ...runRows()];

/** Returns the People schema rows for the stored NPC State settings `bucket` (values as stored, else the default the page shows). */
export function peopleRows(bucket) {
  const b = bucket && typeof bucket === 'object' ? bucket : {};
  // optionsOf and hintOf: a row whose choices or note depend on what is stored (the Portraits style list and preset count); act: a button row's action.
  return ALL().map(({ read, write, store, dflt, reset, optionsOf, hintOf, act, ...rest }) => ({
    ...rest, value: read(b), default: null, ...(optionsOf ? { options: optionsOf(b) } : {}), ...(hintOf ? { hint: hintOf(b) } : {}),
  }));
}

/** Returns the row spec for a `people.*` key (with `write(value, bucket)`, or a button's `act(label, bucket)`, → [[bucketKey, value], ...] or null), or null. */
export function peopleSpec(key) {
  return ALL().find(r => r.key === key) ?? null;
}

/** Returns what Reset People does: [[bucketKey, default], ...] for every row that can be written. */
export function peopleResets() {
  return ALL().flatMap(r => r.reset ?? []);
}
