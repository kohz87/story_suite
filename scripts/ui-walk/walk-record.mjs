// The settings walk's result records: make one, mark a failed check, attach a screenshot, and compare shown values.

const safe = text => String(text).replace(/[^a-z0-9.-]+/gi, '_').slice(0, 90);

/** Two shown values are the same when their text is (an input gives "5" for 5). */
export const same = (a, b) => String(a) === String(b);

/** A result record for `control` with `base` ({ combo, section }); `fields` adds or overrides. */
export function record(base, control, fields = {}) {
  return { ...base, id: control.id, label: control.label, kind: control.kind, status: 'pass', notes: [], shots: [], checks: {}, ...fields };
}

/** Marks a record failed on `check`, with an optional note. */
export function fail(r, check, note) {
  r.status = 'fail';
  r.checks[check] = false;
  if (note) r.notes.push(note);
}

/** Saves a screenshot of the page now for a failed record into `out`. */
export async function shoot(session, r, check, out) {
  const path = `${out}/${safe(`${r.combo}__${r.section}__${r.id}__${check}`)}.png`;
  if (await session.shot(path)) r.shots.push(path);
}
