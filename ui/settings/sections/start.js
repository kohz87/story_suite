// Frames a section hook page: the overlay's own body for the section, with the hook's notes before or after it.

/** Returns `before`, then the overlay's body for `section` (`ctx.body`), then `after`; the page adds the heading, note and resets. */
export function sectionFrame(section, ctx, opts = {}) {
  return [...(opts.before ?? []), ...(ctx.body?.(section) ?? []), ...(opts.after ?? [])];
}

/** Returns the Start section body (scope, presets, module cards, Reset and the Gone list come from the overlay). */
export function renderStartSection(section, ctx) {
  return sectionFrame(section, ctx);
}
