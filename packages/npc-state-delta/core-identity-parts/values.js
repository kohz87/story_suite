/* NPC State Delta identity: clamping and normalizing numbers, booleans, gender and dossier-signal values. */
import { normalizeName } from '../core-text.js';

export function clamp(value, min = 0, max = 100) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
}

export function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value === 'string') {
        const text = value.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'on'].includes(text)) return true;
        if (['false', 'no', 'n', '0', 'off', ''].includes(text)) return false;
    }
    return Boolean(fallback);
}

export function normalizeGender(value) {
    const text = normalizeName(value);
    if (['male', 'man', 'boy'].includes(text)) return 'male';
    if (['female', 'woman', 'girl'].includes(text)) return 'female';
    return '';
}

export function normalizeDossierSignal(value) {
    const signal = String(value ?? '').trim().toLowerCase();
    return ['incidental', 'meaningful', 'persistent'].includes(signal) ? signal : 'incidental';
}
