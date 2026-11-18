// Pack format 4, the game pack's calendar: its fields and limits (the months, era and holidays keep their format 3 limits in calendar.js).

// `content.calendar` of a game pack: no `start` (the world's start date is the world pack's), plus leap years, the week and the seasons.
export const GAME_CALENDAR_FIELDS = Object.freeze(['months', 'era', 'leapYears', 'week', 'seasons', 'holidays']);
export const GAME_CALENDAR_LIMITS = Object.freeze({ week: 14, dayName: 24, seasons: 12, seasonName: 24, seasonMonths: 60 });
