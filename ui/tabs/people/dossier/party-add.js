// Builds "Add to party" on a person's page: the button, and the join card it opens (the card a `+ party` line gives: Add as is, Edit first, Not now).
import { h } from '../../../kit/dom.js';
import { button } from '../../../kit/controls.js';
import { openSheet } from '../../../kit/sheet.js';

/**
 * Opens the join card for `join` (the dossier's `partyAdd`). Add as is sends the engine's own reader action with `cause: 'ui'`, as the card under a reply does;
 * Edit first asks the port to open the New character window filled in (`port.open`); Not now only closes the card: it answers nothing to the story.
 * ctx = { port, doc?, backStack?, sheetHost?, onAdded? }; `onAdded()` is called once the engine took the add. Buttons are off while a command runs. Returns the sheet.
 */
export function openJoinCard(join, ctx = {}) {
  const sheet = openSheet(ctx, { title: join.title, id: 'party-add' });
  const note = h('p', { class: 'pa-note', role: 'status' });
  let busy = false;
  const buttons = [];
  const lock = on => { busy = on; for (const b of buttons) b.disabled = on; };
  const run = async action => {
    if (busy) return;
    lock(true);
    if (action.command) {
      const result = await ctx.port?.command?.(action.command, action.payload, { cause: 'ui' });
      if (result?.ok === false) { note.textContent = result.message || 'The party could not take them.'; lock(false); return; }
      ctx.onAdded?.();
    } else if (action.open) {
      const result = await ctx.port?.open?.(action.open, action.payload);
      if (result?.ok === false) { note.textContent = result.message || 'The window could not open.'; lock(false); return; }
    }
    sheet.close();
  };
  // (the card's No answers the story's own offer: here there is none, so Not now is the sheet's close)
  const shown = join.actions.filter(action => action.id !== 'no' && (action.command || action.open));
  sheet.body.append(
    ...join.rows.map(row => h('p', { class: 'pa-row' }, row.text)),
    note,
    h('div', { class: 'pa-acts' },
      ...[...shown.map(action => button({ label: action.label, tone: action.primary ? 'primary' : 'default', dataset: { act: action.id }, onClick: () => run(action) })),
        button({ label: 'Not now', dataset: { act: 'no' }, onClick: () => sheet.close() })].map(b => { buttons.push(b); return b; })));
  return sheet;
}

/** The hero's "Add to party" button for a dossier view-model, or null when the person may not join. */
export function partyAddButton(d, ctx = {}) {
  if (!d.partyAdd) return null;
  return button({ label: 'Add to party', dataset: { act: 'party-add' }, onClick: () => openJoinCard(d.partyAdd, ctx) });
}
