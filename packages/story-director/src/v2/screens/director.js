// Story Director v2, part screens: `story-director/director` (SPEC §13.1), the Director screen: the author's view of the plan,
// in the game view only (no tab mount, so never in the Story panel's strip; always in the game view's bar). A reader's
// spoiler switch hides the arc, plan and Ripples on this device; it defaults to shown and does not change story state.
//
// Cards, each short (the first few rows and "+N more" that opens it, no inner scroll box): the arc (widget `story-director.arc`,
// opened: name, beats played, what it is about, Plan next arc / End arc), then widget `story-director.plan` (behind.js, from
// `director.plan`): Beats, "Hooks the story is planning" (with Next), Off-screen (agendas: wants, At, Next), Secrets and
// Problems (those about the visible threads, then those behind the scenes); Off-screen agendas show their step bar, place and
// "arriving within the hour" (queries.js agendaSteps). The World pulse card (feature `story-director.pulse`, query `pulse.view`) and the
// Quiet scene switch (command `director.pulse.quiet`) lead the screen. The switch is a pill in Story Block's game-view header (the part's
// `headerControls`, query `pulse.quiet`); it sits at the top of this screen only where the host has no such slot (`localSwitch`). No clock line (the hero header has it), no Quests
// (the Quests tab) and no World list (World's News). The beats, off-screen and secrets belong to the feature
// `story-director.threads` (src/v2/threads.js). Read-only but for the arc's own tools.
// Public face: re-exports its parts.

export { DIRECTOR_ID, directorScreen } from './director-parts/screen.js';
export { SPOILER_STORE, createSpoilerPreference } from './director-parts/spoiler-preference.js';
export { SPOILER_WIDGET, createSpoilerSwitchWidget, spoilerSwitchWidget } from './director-parts/spoiler-switch.js';
export { KIND_GROUPS, OPEN_KIND_GROUPS } from './director-parts/kinds.js';
export { PULSE_FEATURE, pulseQuiet, pulseView } from './director-parts/pulse.js';
