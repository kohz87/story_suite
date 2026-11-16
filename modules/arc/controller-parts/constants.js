// Arc controller module constants, Story Block requirement text, and planner timeout.

export const MODULE_ID = 'story-director';
/** The Story Block that gives modules a model call (`sdk.callModel`). */
export const ARC_NEEDS_STORY_BLOCK = '2.0.0-beta.1';
export const NEEDS_TEXT = `Arc planning needs Story Block ${ARC_NEEDS_STORY_BLOCK} or newer (it asks the planner through Story Block). Update Story Block to plan arcs.`;
/** How long the planner may take (Story Block's callModel keeps it between 1 s and 10 min). */
export const PLANNER_TIMEOUT_MS = 180_000;
