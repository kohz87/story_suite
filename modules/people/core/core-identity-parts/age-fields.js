/* NPC State Delta identity: normalizing the age and apparent age of a raw or stored NPC record together. */
import { cleanText } from '../core-text.js';
import { normalizeAge } from './age-chronological.js';
import { normalizeApparentAge } from './age-apparent.js';

export function normalizeAgeFields(raw = {}) {
    const seed = raw.name || raw.id || raw.species || raw.race || '';
    const rawAge = cleanText(raw.age, 80);
    const rawApparent = cleanText(raw.apparentAge ?? raw.apparent_age, 80);
    let age = normalizeAge(rawAge);
    let apparentAge = normalizeApparentAge(rawApparent, seed);

    // Defensive scanner compatibility: qualitative cues accidentally returned in age are visual age.
    if (rawAge && !age && !apparentAge) apparentAge = normalizeApparentAge(rawAge, seed);
    return { age, apparentAge };
}

export function normalizeStoredAgeFields(raw = {}) {
    const seed = raw.name || raw.id || raw.species || raw.race || '';
    return {
        age: normalizeAge(cleanText(raw.age, 80)),
        apparentAge: normalizeApparentAge(cleanText(raw.apparentAge ?? raw.apparent_age, 80), seed),
    };
}
