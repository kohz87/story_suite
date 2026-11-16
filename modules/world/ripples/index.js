// Story Director v2, part **ripples**: a hidden, derived sway per named power (pure; nothing stored).
//
// A pack's content section `ripples` names the powers rival claimants can win over, the tiers and caps the
// scoring uses, and the pack's own world directions. Nothing is stored: every call rebuilds each power's sway
// from the head state the wiring hands in (quests, chronicle events, Story Block standing changes, board fights
// won), so a swipe, a rebuild, a reload or a delete gives the same answer for the same state.
//
// * **Table** (`validateRipples`): a section that is not an object, or has no usable power, is ignored with a
//   Problem (`table` null). A bad power is dropped with a Problem and the rest stay. Ids are lowercase slugs and
//   unique; base is 0..100; tiers and caps are whole numbers (else their default).
// * **Signals** (`swayOf`). Each signal's total is clamped to its own cap (`caps.quest`, `caps.event`,
//   `caps.standing`, `caps.fight`), then the power's total to ±`caps.power`. Sway = base + total, 0..100.
//   - quests: a resolved quest scores for ONE power, the one it served: the giver's (the giver names the power's
//     labels or givers); with no giver match, the power the key, name or summary names when that is only one.
//     Two or more claimants named: none. done: +small, or +great when `great`; failed: −failed; abandoned: −abandoned.
//   - world events: a resolved event (`open: false`) the pack gives a direction to (`worldDirections`: matched by
//     name, aka or id, folded). The favoured power gets +great, or −great when how it ended (the event's summary)
//     has one of the entry's `unless` words; a power the event's factions name gets −small when the event went
//     the favoured way.
//   - standing: Story Block's standing key change since the chat's start: its value minus the power's `standingBase` (0).
//   - fights: a board fight won against a group naming one of the power's `npcs` (its own people): −fight × the weight.
// * **Inputs** (plain arrays, newest first is the wiring's choice; ties keep that order):
//   `quests [{ key, name, giver, summary, outcome: 'done'|'failed'|'abandoned'|null, great, at }]`,
//   `events [{ id, name, aka: [name], summary, factions: [name], open, at }]`, `standing [{ key, delta, at }]`,
//   `fights [{ won, groups: [name], at }]`.
// * **Leader** (`leaderOf`): the top or bottom power among a list of ids (pack order breaks ties); null when
//   there is no table, no powers to pick from, or `pick` is neither 'top' nor 'bottom'.
// Names match case-folded, as whole words ("Corvin's" matches Corvin; "Chasseurs" does not match Hasse).
// Public face: re-exports its parts.

export { RIPPLES_SECTION, DEFAULT_TIERS, DEFAULT_CAPS } from './index-parts/defaults.js';
export { validateRipples } from './index-parts/table.js';
export { swayOf, leaderOf } from './index-parts/sway.js';
export { tableOf, problemsQuery, inputsOf } from './index-parts/reads.js';
export { swayQuery, leaderQuery } from './index-parts/queries.js';
export { part } from './index-parts/part.js';
