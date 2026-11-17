// Turns the card-offer controller's offers into the plain rows the new view draws (text only; it never re-reads the card).

const text = value => (typeof value === 'string' ? value : '');
const STATES = new Set(['offer', 'working', 'done', 'failed']);

/** `controller.offers()` → rows; a controller that is missing or throws gives []. Only `offers()` is called: a redraw must not re-read the lorebook. */
export function offerRows(controller) {
  let list = [];
  try { list = controller?.offers?.() ?? []; } catch { return []; }
  return (Array.isArray(list) ? list : []).filter(item => item && STATES.has(item.state)).map(item => ({
    id: text(item.id),
    packId: text(item.packId),
    name: text(item.name),
    version: text(item.version),
    installedVersion: item.installedVersion == null ? null : text(item.installedVersion),
    update: item.update === true,
    state: item.state,
    result: text(item.result),
    brings: text(item.brings),
    notes: (Array.isArray(item.notes) ? item.notes : []).map(text),
    blocked: item.blocked === true,
    settings: (Array.isArray(item.settings) ? item.settings : []).map(setting => text(setting?.text)).filter(Boolean),
  }));
}

/** How many offers wait for an answer (the Needs you count). */
export const waitingCount = rows => rows.filter(row => row.state === 'offer' || row.state === 'working').length;
