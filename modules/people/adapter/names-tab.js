// The Dossiers tab's names: its id (still `cast`, so a saved tab order finds it), title and icon, and the class of a present person's page slot.

// The tab's id stays `cast` (and the screen's `npc-state-delta/cast`) so a reader's saved tab order still
// finds it; its title is Dossiers (MODULES §F119).
export const CAST_TAB_ID = 'cast';

export const DOSSIERS_TITLE = 'Dossiers';

export const DOSSIERS_ICON = 'fa-address-book';

/**
 * The cast API for Story Director's World screen, on the in-process handle (runtime/handles.js castApi) while the adapter runs (read-only; it
 * changes nothing in Delta): { version, available(), render(el, { slot }) → number of present cards drawn,
 * onChange(fn) → off }. `render` draws Delta's own present-cast cards and meters into `el` (the markup and
 * classes the Cast tab drew) and, with `slot(name, aliases)` → a node or null, puts that node inside each
 * present person's card (class PAGE_SLOT_CLASS; drawn again on every render). `onChange(fn)` calls `fn`
 * after Delta's cast or state may have changed (a cast drawn, a scan or edit, Delta on or off, hosted or
 * not); the caller redraws then.
 */
export const PAGE_SLOT_CLASS = 'ppl-slot';
