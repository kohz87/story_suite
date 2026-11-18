// Renders the People section: its module switches, then the feelings, pacing, stages, dossier, Refresh, portraits and map groups,
// with the list editors (custom meters, per-meter stages, the stage ladder) under their rows.
import { sectionFrame } from './start.js';
import { attachPeopleLists } from './people-lists.js';
import { renderRoster } from '../people-roster.js';

// The last Re-read's answer, kept per overlay so a repaint still shows it.
const NOTES = new WeakMap();

/**
 * Returns the People page nodes for `section`; `ctx` is the overlay context. The rows are read again for each draw (`ctx.view`), so a
 * repaint (a module switch) shows what is stored now, not the values the overlay opened with.
 */
export function renderPeopleSection(section, ctx) {
  let fresh = null;
  try { fresh = ctx.view?.('settings')?.sections?.find(s => s.id === section.id) ?? null; } catch { fresh = null; }
  const page = fresh ?? section;
  const note = { get text() { return NOTES.get(ctx) ?? ''; }, set: text => NOTES.set(ctx, text) };
  let roster = null;
  try { roster = ctx.view?.('roster') ?? null; } catch { roster = null; }
  return [...attachPeopleLists(sectionFrame(page, ctx), page, ctx), renderRoster(roster, ctx, note)];
}
