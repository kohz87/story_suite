// Deterministic birthday generation and birth date derivation from age.
import {
    deriveBirthDateFromAgeParts,
    deterministicCalendarBirthday,
} from '../calendar.js';
import { activeOrProvided } from './shared-config.js';

export function deterministicBirthday(seed, config = undefined) {
    return deterministicCalendarBirthday(seed, activeOrProvided(config));
}

export function deriveBirthDateFromAge(birthDate, age, referenceDate = null, config = undefined) {
    return deriveBirthDateFromAgeParts(birthDate, age, referenceDate, activeOrProvided(config));
}
