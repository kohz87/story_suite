// Story Suite v2: the reader's Text size: its sizes and reading it from a settings record.

import { DEFAULT_TEXT_SIZE } from './defaults.js';

/**
 * The reader's Text size (host setting `textSize`, kept as text): Normal, 110% or 120% of the size Story Suite is drawn at
 * (view/size.css `--ss-zoom`, 0.8). Normal adds nothing to the sheet, so it is the same bytes as before the setting; the
 * others set `--ss-zoom` to the size times 0.8, which every Story Suite root already follows (its content grows and
 * reflows, its frames keep their size, SillyTavern's own text is not touched).
 */
export const TEXT_SIZES = Object.freeze({ 100: null, 110: 0.88, 120: 0.96 });
/** The Text size in a settings record, as one of the keys of TEXT_SIZES ('100' for anything else). */
export const textSizeOf = settings => {
    const value = String(settings?.textSize ?? '').trim();
    return Object.hasOwn(TEXT_SIZES, value) ? value : DEFAULT_TEXT_SIZE;
};
