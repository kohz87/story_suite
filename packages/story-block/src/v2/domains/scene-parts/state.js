// The scene slice's starting record and its validator. Pure.

import { isPlainObject } from '../common.js';
import { trimText } from '../names.js';
import { validateMounts } from '../mounts.js';
import { MAX_NAME, MAX_PRESENT, WEATHER_CHARS, WEATHER_KEY_CHARS, YOU_CHARS, YOU_PARTS } from '../scene/constants.js';

export function initialScene() {
    return { place: { name: '', kind: '', region: '' }, present: [] };
}

/** §2.5 validator for the scene slice: [] when fine, else plain sentences. */
export function validateScene(slice) {
    if (!isPlainObject(slice)) return ['The scene is not a record.'];
    const errors = [];
    const place = slice.place;
    if (!isPlainObject(place)) errors.push('The scene has no place record.');
    else {
        for (const field of ['name', 'kind', 'region']) {
            if (typeof place[field] !== 'string') errors.push(`The place's ${field} is not text.`);
            else if (place[field].length > MAX_NAME) errors.push(`The place's ${field} is longer than ${MAX_NAME} characters.`);
        }
    }
    if (!Array.isArray(slice.present)) errors.push('The scene has no list of who is present.');
    else {
        const seen = new Set();
        for (const name of slice.present) {
            if (typeof name !== 'string' || !name.trim()) {
                errors.push('Someone present has no name.');
                continue;
            }
            if (name.length > MAX_NAME) errors.push(`The name "${trimText(name, 30)}" is longer than ${MAX_NAME} characters.`);
            if (seen.has(name.toLowerCase())) errors.push(`${name} is listed as present twice.`);
            seen.add(name.toLowerCase());
        }
        if (slice.present.length > MAX_PRESENT) errors.push(`At most ${MAX_PRESENT} people can be listed as present.`);
    }
    // The weather (`~ weather`, MODULES §F120): absent until a reply first writes one.
    if (slice.weather !== undefined) {
        const weather = slice.weather;
        if (!isPlainObject(weather)) errors.push('The weather is not a record.');
        else {
            if (typeof weather.text !== 'string' || !weather.text.trim()) errors.push('The weather has no text.');
            else if (Array.from(weather.text).length > WEATHER_CHARS) errors.push(`The weather is longer than ${WEATHER_CHARS} characters.`);
            if (!Number.isSafeInteger(weather.rev) || weather.rev < 0) errors.push('The weather\'s rev is not a whole number.');
            if (weather.key !== undefined && (typeof weather.key !== 'string' || !weather.key || Array.from(weather.key).length > WEATHER_KEY_CHARS)) errors.push(`The weather's key is not text of at most ${WEATHER_KEY_CHARS} characters.`);
        }
    }
    errors.push(...validateMounts(slice));
    // {{user}}'s look (`~ you`, MODULES §F126): absent until a reply first writes one; each part may be missing (read as '').
    if (slice.you !== undefined) {
        if (!isPlainObject(slice.you)) errors.push('Your look is not a record.');
        else {
            for (const part of YOU_PARTS) {
                const value = slice.you[part];
                if (value === undefined) continue;
                if (typeof value !== 'string') errors.push(`Your ${part} is not text.`);
                else if (Array.from(value).length > YOU_CHARS) errors.push(`Your ${part} is longer than ${YOU_CHARS} characters.`);
            }
        }
    }
    return errors;
}
