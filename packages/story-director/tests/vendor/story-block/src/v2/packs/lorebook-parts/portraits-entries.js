// The job: recognising and listing the `[storysuite:portraits]` entries of a card's lorebook.

import { findTagged } from './shared-tagged.js';

export const PORTRAITS_TAG = '[storysuite:portraits]';
const PORTRAITS = /\[\s*storysuite\s*:\s*portraits\s*\]/i;

/** Is this title tagged as the card's portraits? */
export const isPortraitsTitle = title => PORTRAITS.test(String(title ?? ''));

/** The `[storysuite:portraits]` entries of a list, in lorebook order: `[{ origin, title, text }]`. */
export const findPortraitEntries = entries => findTagged(entries, isPortraitsTitle, PORTRAITS);
