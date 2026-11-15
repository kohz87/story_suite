// What the Calendar settings show (terms2, live test 2026-10-22: "SD calendar should populate the field
// for calendar from pack if it's using pack, otherwise it's misleading").
//
// The tracker's calendar setting is `tracker.calendar.preset` (pack, gregorian or custom) and the fields of
// a custom calendar (era, months, leap years, weekdays). With `pack` the chat runs on the enabled pack's
// calendar (time.js calendarConfig), but the fields used to show their Gregorian defaults. Now:
//
// * the fields' defaults are the calendar in use while the reader has not written their own: the pack's
//   (its era and months, no leap years, no weekdays) when a pack has one, else Gregorian. So with `pack`
//   they show the pack's calendar, and switching to Custom starts from it (a field the reader edits is
//   theirs from then on);
// * while Calendar is pack the fields are read-only (Story Block's settings `readOnly`): they show the
//   pack's calendar (`shows`, even over a calendar the reader stored under Custom, which is kept) and
//   cannot be edited; switching to Custom makes them editable, pre-filled with it or the reader's own;
// * the Calendar choice's help says where the calendar comes from ("From the pack: Ersveil: Bluewatch
//   Starter, CY, 12 months: switch to Custom to edit"), and the fields' help that they are only used
//   with Custom.
//
// Both are worked out when the settings are drawn (getters on the module's defaults and schema), from
// Story Block's live queries (`packs.calendar`, `packs.list`) and this module's stored settings.
// The pure parts are exported for tests.
// Public face: re-exports its parts.

export { CALENDAR_KEYS, packCalendarFields, gregorianFields, calendarReadOnly } from './calendar-settings-parts/fields.js';
export { packName, presetHelp, fieldHelp } from './calendar-settings-parts/help.js';
export { liveCalendarSettings } from './calendar-settings-parts/live.js';
export { hasNoWeek, calendarRule, foreignNames } from './calendar-settings-parts/names.js';
