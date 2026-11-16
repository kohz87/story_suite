// Normalizing the gate settings (window days and strength), also from the module's stored settings.
import { GATE_STRENGTHS, DEFAULT_GATE_SETTINGS } from './strengths.js';

const numberOr = (value, fallback) => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? fallback : Number(value));
export const GATE_WINDOW_MAX = 14;

/** The gate settings as { windowDays: whole days 1..14, strength: 'light' | 'normal' | 'strong' }. Blank or unknown means the default. */
export function normalizeGateSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const days = Math.round(numberOr(source.windowDays, DEFAULT_GATE_SETTINGS.windowDays));
    return {
        windowDays: Math.max(1, Math.min(GATE_WINDOW_MAX, days)),
        strength: Object.hasOwn(GATE_STRENGTHS, source.strength) ? source.strength : DEFAULT_GATE_SETTINGS.strength,
    };
}

/** The gate settings of the module's stored settings (`gateDays`, `gateStrength`), normalized. */
export const gateSettingsOf = raw => normalizeGateSettings({ windowDays: raw?.gateDays, strength: raw?.gateStrength });
