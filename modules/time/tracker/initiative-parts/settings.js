// Story Director v2, tracker part (initiative): reads the feature switch and settings the initiative rules take.

import { settingsFrom } from '../time.js';
import { DEFAULT_COOLDOWN, FEATURE, MAX_COOLDOWN } from './config.js';
import { isInt } from './shared-guards.js';

/** The `initiativeCooldown` setting: 2 to MAX_COOLDOWN, else the default. */
export function cooldownOf(settings) {
    const value = settings?.initiativeCooldown;
    return isInt(value) && value >= DEFAULT_COOLDOWN ? Math.min(MAX_COOLDOWN, value) : DEFAULT_COOLDOWN;
}

/** Whether the feature is on (`ctx.feature` / `view.feature` when the host has them, F100), else on. */
export const initiativeOn = source => (typeof source?.feature === 'function' ? source.feature(FEATURE) !== false : true);

export const settingsOf = source => settingsFrom(typeof source === 'function' ? source() : source);
