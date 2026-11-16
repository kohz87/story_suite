// Cast domain feature identifier and face-rate setting defaults.

export const FEATURE = 'story-director.cast';

/** The settings' defaults. `faces`: how many new faces may cross the party's path (day1, day2, week1). */
export const FACES = Object.freeze({ day1: { label: '1 a day', count: 1, days: 1 }, day2: { label: '2 a day', count: 2, days: 1 }, week1: { label: '1 a week', count: 1, days: 7 } });
export const DEFAULT_FACES = 'day1';
