// Battle marker: the `[battle]` marker lines are the fight board's word, stripped by the interaction marker rule.

import { stripMarkers } from '../../interaction/markers.js';

/** `text` without its `[battle]` marker lines (a line `[battle]` of its own, the reader-only battle-log place, goes with one blank line after it). */
export const stripBattleMarker = text => stripMarkers(text, ['battle']);
