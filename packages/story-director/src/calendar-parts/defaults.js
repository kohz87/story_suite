// Story Director: calendar character limits, week bounds and default parts of day.

export const DEFAULT_PARTS_OF_DAY = Object.freeze({
    dawn: 360, morning: 540, noon: 720, afternoon: 900,
    dusk: 1140, evening: 1140, night: 1320, midnight: 0,
    // (0.9.11) The sun's own words, as stories write deadlines ("Goldwane 12 sunset").
    sunrise: 360, daybreak: 360, sunset: 1140, sundown: 1140,
});

// (0.9.21) A custom calendar's week: up to this many day names. None: the world has no weekdays.
export const MAX_WEEK_DAYS = 14;

// The longest era, month name and day name a calendar keeps (the reader's settings are free text).
export const ERA_CHARS = 24;
export const NAME_CHARS = 40;
