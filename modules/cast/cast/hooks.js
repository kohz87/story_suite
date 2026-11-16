// Story Director v2, part **cast**: the two hooks that run the living cast.
//
// * `afterReceive` (a reply has arrived and been read): when the story day changed or a stretch of time passed since the cast last
//   moved, or a goal the story just touched may be pulling someone to the party, the planner is asked (plan.js) in the background, on
//   the model's own connection or the chat's (which is free by then). Nothing is written here.
// * `beforeGenerate` (a reply is about to be written): up to three system steps, in this order, each only when it has something to say:
//   `cast.sync` (the packs' cast joined, changed or left), `cast.advance` (the planner's answer, or the clock followed back), `cast.meet`
//   (someone crosses the party's path, by place and routine or by a goal the planner cited). The steps are on the reply, so a swipe takes
//   them back and does them again (the planner's answer is kept, so who comes does not change with a rewrite of the scene), and a
//   rebuild gives the same world. A Continue (the same reply goes on) commits nothing.
//
// Without a model (an older Story Block, or the call failing) nobody moves, and meetings by place still happen. With no cast in the
// enabled packs the hooks do nothing at all, so the prompt and the state are as they were.
// Public face: re-exports its parts.

export { shownText, recentStory, soughtTexts } from './hooks-parts/text.js';
export { PLAN_FAILED, createCastHooks } from './hooks-parts/hooks.js';
