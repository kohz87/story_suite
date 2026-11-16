// Story Director: what time closes on its own (pure).
//
// (0.9.19) Two things the story can leave hanging for ever: a beat whose date went by without
// the story firing it, and an offer nobody took before its deadline. Neither is closed here:
// these only say which records are due to close, and index.js writes the `-` lines into the
// reply where the time passed, so deleting or swiping that reply takes the closing back.
// Public face: re-exports its parts.
export { LAPSED_REASON, SLIPPED_REASON, SLIP_GRACE_DAYS, UNDATED_OFFER_DAYS } from './lapses-parts/constants.js';
export { lapseTime, lapsedOffers, slippedBeats } from './lapses-parts/detect.js';
export { lapseLines, lapsesIn } from './lapses-parts/lines.js';
