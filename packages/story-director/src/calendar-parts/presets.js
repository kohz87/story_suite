// Story Director: built-in Gregorian and custom30 calendar presets.
import { DEFAULT_PARTS_OF_DAY } from './defaults.js';
import { deepFreeze } from './shared-utils.js';

export const GREGORIAN_MONTHS = [
    ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
    ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
].map(([name, days]) => ({ name, days }));

export const GREGORIAN_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const PRESETS = deepFreeze({
    gregorian: {
        preset: 'gregorian', era: '', months: GREGORIAN_MONTHS, daysPerMonth: 30,
        leapYears: true, partsOfDay: { ...DEFAULT_PARTS_OF_DAY },
    },
    custom30: {
        preset: 'custom', era: '',
        months: Array.from({ length: 12 }, (_, i) => ({ name: `Month ${i + 1}`, days: 30 })),
        daysPerMonth: 30, leapYears: false, partsOfDay: { ...DEFAULT_PARTS_OF_DAY },
    },
});
