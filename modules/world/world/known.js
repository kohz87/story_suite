// Story Director v2, part **world**: what the player character knows, worked out on read (pure). Nothing
// here is stored: every answer comes from the state it is given and the queries of the other parts and
// modules (through `tools.query`), so a swipe, a middle delete or a reload shows the same as a rebuild.
//
// What {{user}} knows ("PC-known"), exactly:
// * Here: the scene's place (Story Director's map place, `atlas.here`, else Story Block's `scene.place`)
//   and the people Story Block's scene lists as present (`scene.present`): the story put them there.
// * News and events: the chronicle's world events (written by a reply's `world` line, which the story
//   tells, or by the reader on the Chronicle screen) and the Director's `event` threads (dated happenings
//   a reply wrote). Factions: the chronicle's factions, by the same rule.
// * Upcoming: open quests' `due:` dates (a quest is a job {{user}} accepted), the `on:` dates of open
//   events and hooks, and the pack calendar's holidays (`packs.calendar().holidays`), within the next N
//   story days (setting `world.upcomingDays`).
// Never shown, while hidden or not: agendas, beats, clocks and secrets (behind the scenes, screens/reveal.js),
// anything the arc planner made or touched (a thread with `track.arc`: its words are the planner's, not
// the story's), the arcs themselves, and the Director's problems. A chronicle event or faction named like
// a secret or an arc is left out too, and a journal line that names one is dropped, so a hidden name never reaches
// the page through another list. A chronicle event the story wrote is the story's own even when an agenda, beat
// or clock bears its name (only that thread's planning text is hidden), so it shows in News; a faction's
// "Seen in: <event>" summary follows the same rule: it shows only while that event is in News.
// Quests show their name, goal and due date only (a plan line can never write those).
// Public face: re-exports its parts.

export { FEATURE } from './known-parts/feature.js';
export { DEFAULT_UPCOMING_DAYS, MAX_UPCOMING_DAYS, upcomingDaysOf } from './known-parts/upcoming-days.js';
export { NEWS_SHOWN, FACTIONS_SHOWN, UPCOMING_SHOWN, SUMMARY_POINTS } from './known-parts/shared-limits.js';
export { cut } from './known-parts/shared-text.js';
export { queryOf, tryQuery } from './known-parts/query.js';
export { calendarFrom, nowFrom } from './known-parts/clock.js';
export { daysText, agoText } from './known-parts/day-words.js';
export { hiddenNames, namesHidden } from './known-parts/hidden.js';
export { hereView } from './known-parts/here.js';
export { knownNews, knownFactions } from './known-parts/news.js';
export { holidays } from './known-parts/holidays.js';
export { knownUpcoming } from './known-parts/upcoming.js';
export { worldView } from './known-parts/view.js';
