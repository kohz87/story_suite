// A one-shot note from Settings › Packs and trackers to Story › Trackers: which sheet to open when the tab appears ({ edit: id } or { template: true }).
let pending = null;

/** Leaves a note for the next Trackers view; anything that is not an edit of one tracker or the template list is dropped. */
export function leaveTrackerIntent(value) {
  pending = typeof value?.edit === 'string' && value.edit ? { edit: value.edit } : value?.template === true ? { template: true } : null;
}

/** Hands the note over once (the view that reads it clears it, so a redraw never reopens the sheet). */
export function takeTrackerIntent() {
  const note = pending;
  pending = null;
  return note;
}
