// The weather's character caps and its feature name. Pure.

import { CORE_FEATURE } from '../../../core/features.js';

/** A weather text is at most this many code points (cut, an ellipsis in the last place). */
export const WEATHER_CHARS = 60;
/** The weather in the tail's Place line is cut to this many code points (about 8 tokens with its separator). */
export const WEATHER_TAIL_CHARS = 26;
export const WEATHER_FEATURE = CORE_FEATURE.weather;
