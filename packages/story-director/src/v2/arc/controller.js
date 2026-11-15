// Story Director v2, part **arc**: planning, on the reader's side of the page (not story state).
//
// The planner is one model call, on the planner's own connection profile, through Story Block's
// `sdk.callModel({ profile, system, prompt, maxTokens, signal, feature })` → `{ ok, text, error, message }`
// (MODULES §G; Story Block
// ARC_NEEDS_STORY_BLOCK or newer). Without it the arc panel says so plainly and shows no buttons. What
// comes back is read strictly (plan.js readPlan) and waits for the reader's review (Accept, Discard,
// Plan again; Accept without reading while behind the scenes is hidden), unless they chose to accept
// planned arcs automatically (setting `arc.autoAccept`, off by default): then a plan the planner made, by the
// reader's Plan arc or by itself, is accepted at once through the same strict reading and commands, and the
// arc panel says quietly that an arc began (nothing of it while behind the scenes is hidden). Only Accept writes anything, and it does so as the reader's commands
// (commands.js), so the plan is ops on the latest reply like any reader action: replay is the same as
// live, and deleting or swiping that reply takes the plan back.
//
// The waiting plan and when a plan was last asked for are the reader's, kept per chat in the browser's
// storage (screens/reveal.js browserStore), so a swipe never throws a plan away and a reload keeps it.
// Planning by itself (setting `arc.trigger: auto`) runs after a reply: when the story has threads but no
// arc, when every beat of the arc played out (the arc is ended first), when no beat is due within the
// stall window, or when open threads run low (v1 autoPlanReason); never while a plan waits or one is
// being asked for.
//
// Public face: re-exports its parts.

export { MODULE_ID, ARC_NEEDS_STORY_BLOCK, NEEDS_TEXT, PLANNER_TIMEOUT_MS } from './controller-parts/constants.js';
export { storyText, recentStory } from './controller-parts/story.js';
export { createArcController, arcController } from './controller-parts/controller.js';
