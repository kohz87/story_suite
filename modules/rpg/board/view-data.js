// Builds the board's numbered action and target lines from its staged sheet.
// It reads skill flags and current bars; the view only renders the returned plain data.
// Unusable skills stay visible with a reason and cannot be chosen.
// Public face: re-exports its parts.

export { boardChoices, resourcesOf, targetLabel } from './view-data-parts/choices.js';
export { standingMembers, memberHealthWord, memberTargetLine, memberPackLine } from './view-data-parts/members.js';
export { memberGroups, memberOrderLine } from './view-data-parts/member-groups.js';
export { pendingAwards, pendingAwardsLine } from './view-data-parts/awards.js';
export { foeChips, partyChips, groupTarget, stagedLine } from './view-data-parts/chips.js';
