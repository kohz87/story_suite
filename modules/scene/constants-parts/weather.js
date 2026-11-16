// The weather's character caps, its rule mark and its feature name. Pure.

import { CORE_FEATURE } from '../../../core/features.js';

/** A weather text is at most this many code points (cut, an ellipsis in the last place). */
export const WEATHER_CHARS = 60;
/** The weather in the tail's Place line is cut to this many code points (about 8 tokens with its separator). */
export const WEATHER_TAIL_CHARS = 26;
/** The mark a module's rule leaves on the weather it set (`scene.weather` command `key`), at most this many code points. */
export const WEATHER_KEY_CHARS = 80;
export const WEATHER_FEATURE = CORE_FEATURE.weather;
