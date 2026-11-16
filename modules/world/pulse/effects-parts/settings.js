// Reads the pulse's feature switch and mode setting.

import { FEATURE, MODES } from './ids.js';
import { isRecord } from './shared-guards.js';

export const settingsOf = source => { const value = typeof source === 'function' ? source() : source; return isRecord(value) ? value : {}; };
/** Whether the feature is on (`ctx.feature` / `view.feature` when the host has them, F100), else on. */
export const pulseOn = source => (typeof source?.feature === 'function' ? source.feature(FEATURE) !== false : true);
/** Whether the pulse is on and not set to off: the agenda progress is written only then. */
export const pulseActive = source => pulseOn(source) && modeOf(settingsOf(source?.settings)) !== 'off';
/** The `mode` setting: off, quiet (flavour only) or lively (the default). */
export const modeOf = settings => (MODES.includes(settings?.mode) ? settings.mode : 'lively');
