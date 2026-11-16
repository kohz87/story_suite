// NPC State Delta's side of the Story Suite handshake (docs/STORY_SUITE.md). suite.js is the
// shared registry, identical in every suite extension; this module holds what Delta announces and
// how it defers. Alone, every choice behaves like Automatic and Delta is the source of truth for
// all four areas, so nothing here changes Delta's behavior without another suite extension.
// Public face: re-exports its parts.
export { SUITE_ID, SUITE_NAME, SUITE_AREAS, SOURCE_OF_TRUTH_CHOICES } from './suite-handshake-parts/identity.js';
export { normalizeSourceOfTruth } from './suite-handshake-parts/source-of-truth.js';
export { SUITE_STYLESHEET_ID, ensureSuiteStylesheet } from './suite-handshake-parts/stylesheet.js';
export { storyBlockIsV2 } from './suite-handshake-parts/shared-host.js';
export { defersArea, areaOwner } from './suite-handshake-parts/deferral.js';
export { externalCalendar } from './suite-handshake-parts/external-calendar.js';
export { statLikeFieldNames, statsOverlapWarning } from './suite-handshake-parts/stat-fields.js';
export { NPC_PROFILE_ROLE_MAX, NPC_PROFILE_SUMMARY_MAX, buildNpcProfile } from './suite-handshake-parts/profile-build.js';
export { trimAtWord } from './suite-handshake-parts/shared-text.js';
export { buildNpcProfiles } from './suite-handshake-parts/profile-list.js';
export { resolveDossierTarget } from './suite-handshake-parts/dossier-target.js';
export { CHARS_PER_TOKEN, NARRATION_CAPTURE_OUTPUT_ESTIMATE_CHARS } from './suite-handshake-parts/shared-tokens.js';
export { injectionSections, replyTokenEstimate, copyTokenEstimate } from './suite-handshake-parts/token-estimate.js';
export { replyPreview } from './suite-handshake-parts/reply-preview.js';
export { buildManageApi } from './suite-handshake-parts/manage-api.js';
export { suiteManageAvailable, openSuiteOverlay } from './suite-handshake-parts/overlay.js';
export { SUITE_SHOWS, announceNpcStateDelta } from './suite-handshake-parts/announce.js';
