// Reading the social scale and cap from Delta's stored settings.
import {
    DEFAULT_SOCIAL_SCALE,
    MAX_SOCIAL_SCALE,
    DEFAULT_SOCIAL_CAP,
    MAX_SOCIAL_CAP,
} from './limits.js';

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const intIn = (value, min, max, fallback) => (Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);

/** The scale (percent) and cap from Delta's stored settings, clamped: { scale, cap }. */
export function socialSettings(raw = {}) {
    const source = isObject(raw) ? raw : {};
    return {
        scale: intIn(source.socialScale, 0, MAX_SOCIAL_SCALE, DEFAULT_SOCIAL_SCALE),
        cap: intIn(source.socialCap, 1, MAX_SOCIAL_CAP, DEFAULT_SOCIAL_CAP),
    };
}
