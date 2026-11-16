// The job: recognising and listing the `[storysuite:settings]` entries of a card's lorebook.

import { findTagged } from './shared-tagged.js';

export const SETTINGS_TAG = '[storysuite:settings]';
const SETTINGS = /\[\s*storysuite\s*:\s*settings\s*\]/i;

/** Is this title tagged as the card's recommended settings? */
export const isSettingsTitle = title => SETTINGS.test(String(title ?? ''));

/** The `[storysuite:settings]` entries of a list, in lorebook order: `[{ origin, title, text }]`. */
export const findSettingsEntries = entries => findTagged(entries, isSettingsTitle, SETTINGS);
