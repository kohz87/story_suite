/* Normalizers for relationship delta, absolute patch, audit delta and fractional progress. */
import { clamp } from '../core-identity.js';
import { RELATIONSHIP_KEYS } from './profile-defaults.js';

export function normalizeRelationshipDelta(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => {
        const raw = Number(source[key]);
        return [key, Number.isFinite(raw) ? Math.round(clamp(raw, -100, 100)) : 0];
    }));
}

export function normalizeRelationshipAbsolutePatch(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const patch = {};
    for (const key of RELATIONSHIP_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const raw = Number(source[key]);
        if (!Number.isFinite(raw)) continue;
        patch[key] = Math.round(clamp(raw, -100, 100));
    }
    return patch;
}

export function normalizeRelationshipAuditDelta(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => {
        const raw = Number(source[key]);
        return [key, Number.isFinite(raw) ? Math.round(clamp(raw, -200, 200)) : 0];
    }));
}

export function normalizeRelationshipProgress(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => {
        const raw = Number(source[key]);
        if (!Number.isFinite(raw)) return [key, 0];
        const bounded = Math.max(-0.999999, Math.min(0.999999, raw));
        return [key, Math.abs(bounded) < 0.000001 ? 0 : Number(bounded.toFixed(6))];
    }));
}
