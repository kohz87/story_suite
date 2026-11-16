/* Normalizers for the relationship baseline and the per-impact caps. */
import { clamp } from '../core-identity.js';
import { DEFAULT_RELATIONSHIP, RELATIONSHIP_KEYS } from './profile-defaults.js';
import { DEFAULT_RELATIONSHIP_CAPS } from './impact-caps-constants.js';

export function normalizeRelationshipBaseline(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => {
        const number = Number(source[key]);
        const safe = Number.isFinite(number) ? number : DEFAULT_RELATIONSHIP[key];
        return [key, Math.round(clamp(safe, -100, 100))];
    }));
}

export function normalizeRelationshipCaps(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const finiteOr = (raw, fallback) => {
        if (raw === undefined || raw === null || raw === '') return fallback;
        const number = Number(raw);
        return Number.isFinite(number) ? number : fallback;
    };
    const ordinary = Math.round(clamp(finiteOr(source.ordinary, DEFAULT_RELATIONSHIP_CAPS.ordinary), 0, 25));
    const meaningful = Math.max(ordinary, Math.round(clamp(finiteOr(source.meaningful, DEFAULT_RELATIONSHIP_CAPS.meaningful), 0, 35)));
    const major = Math.max(meaningful, Math.round(clamp(finiteOr(source.major, DEFAULT_RELATIONSHIP_CAPS.major), 0, 50)));
    const extreme = Math.max(major, Math.round(clamp(finiteOr(source.extreme, DEFAULT_RELATIONSHIP_CAPS.extreme), 0, 100)));
    return { ordinary, meaningful, major, extreme };
}
