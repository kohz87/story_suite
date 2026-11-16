// Story Director v2, tracker part (note): builds the Director's static prompt text.

// The Director's rules, merged into as few lines as keep every rule (the lean diet, 3 Nov): v1's change-line instruction
// (note.js) stays v1's own; v2 words it here. The change ops are Story Block's header's, so only what is the Director's is said.
// The date rule is here, not in a grammar line, so it is said while the threads feature is off too.
const RULES = [
    'Director lines: ~ only what changed, never the whole list; - closes it (— reason); ! fires a due item (— what happened). Only on, due and arrive take a date, as <date, clock time>. Never write or decide what {{user}} does.',
];

// Pacing, shortened: the "never decide what {{user}} does" rule is in the line above.
const PACING_V2 = 'Pacing: a due item comes in only where it fits (on-screen if {{user}} is there, else later as news, signs or aftermath); never cut into or bend the scene for a beat. What cannot fit yet happens off-screen (!) or waits.';

/**
 * The Director's part of the static prompt: no names, counts, times or dice. The same bytes for one
 * set of modules. `threads: false` leaves out the Pacing paragraph, which belongs to the feature
 * `story-director.threads` (the module hands it to the host as a context part under that feature, so
 * it is sent only while the feature is on). `fights` no longer changes it: the encounter field is in the beat grammar.
 * `calendarRule` (calendar-settings.js calendarRule) is the one line a custom calendar without weekdays adds: the world's own month
 * names and no real-world day or month names. The calendar is a setting, so the line is the same every reply of a story.
 */
export function staticText({ threads = true, calendarRule = '' } = {}) {
    return [...RULES, calendarRule, threads ? PACING_V2 : ''].filter(Boolean).join('\n');
}

/** The Pacing paragraph (a due item comes in only where it fits), the feature `story-director.threads`' own. */
export const PACING_TEXT = PACING_V2;

/** The static part when an optional fight runner is present. */
export const STATIC_TEXT = staticText();
