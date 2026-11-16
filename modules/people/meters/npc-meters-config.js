// NPC meters, the constants and the pure parsers behind them: the meter, secret, stage and feature limits, the key and slug helpers,
// the band, need and rung parsers, normalizeMeterSettings, meterDefs and the stage thresholds. A pure part of npc-meters.js (same
// owner, moved without change); npc-meters.js re-exports every name it exported before. Never imports npc-meters.js. Public face: re-exports its parts.
export { NPC_DOMAIN, NPC_KIND, MILESTONE_KIND, KEY_PEOPLE_QUERY } from './npc-meters-config-parts/identity.js';
export { BUILT_IN_METERS, BUILT_IN_RANGE, CUSTOM_RANGE, TONES } from './npc-meters-config-parts/built-in-meters.js';
export { MAX_CUSTOM_METERS, MAX_NPCS, MAX_METERS_PER_NPC, MAX_STAGES_PER_METER } from './npc-meters-config-parts/limits-counts.js';
export { MAX_SECRETS, MAX_GENERATED_SECRETS, MAX_UNLOCKED, MAX_PROBLEMS } from './npc-meters-config-parts/limits-lists.js';
export { MAX_MILESTONES, MAX_RUNGS, MAX_TRACKS, MAX_BANDS } from './npc-meters-config-parts/limits-ladder.js';
export { MAX_NEEDS, DEFAULT_CHANGE_CAP, MAX_CHANGE_CAP, DEFAULT_CONFLICT_AT } from './npc-meters-config-parts/limits-pacing.js';
export { DEFAULT_DEMOTE_AFTER, DAY_MINUTES, RECENT_MESSAGES } from './npc-meters-config-parts/limits-time.js';
export { SECRET_TEXT_MAX, SECRET_TITLE_MAX, SECRET_WHEN_MAX, NOTE_SOURCES } from './npc-meters-config-parts/limits-secrets.js';
export { MILESTONE_MAX, DESCRIBE_MAX, TAIL_SECRETS_PER_NPC, CONTEXT_BUDGET } from './npc-meters-config-parts/limits-display.js';
export { FEATURE_STAGES, FEATURE_DRIFT, FEATURE_PRESETS, FEATURE_SCAN_EVERY_REPLY } from './npc-meters-config-parts/feature-ids.js';
export { FEATURE_GATE, FEATURE_MOOD_PULL, FEATURE_NOTES } from './npc-meters-config-parts/feature-ids-more.js';
export { FEATURES, FEATURE_DEFAULTS } from './npc-meters-config-parts/features.js';
export { NAME_MAX, LABEL_MAX, STAGE_NAME_MAX, DISPOSITION_MAX } from './npc-meters-config-parts/text-limits.js';
export { KEY_MAX, METER_ID_MAX, TRACK_MAX } from './npc-meters-config-parts/key-limits.js';
export { REASON_LABELS, FORBIDDEN_KEYS, WORDS, RECORD_FIELDS } from './npc-meters-config-parts/record-words.js';
export { IMPACT_TIERS, tierOf } from './npc-meters-config-parts/impact-tiers.js';
export { isObject, isInt, clamp, own } from './npc-meters-config-parts/values.js';
export { leafText, readLeaf } from './npc-meters-config-parts/leaf.js';
export { isReplyId, replyKey, sameReply } from './npc-meters-config-parts/reply-keys.js';
export { clean, intOr, signed } from './npc-meters-config-parts/text.js';
export { slug, npcKey, wordKey } from './npc-meters-config-parts/slugs.js';
export { parseBands, bandWord } from './npc-meters-config-parts/bands.js';
export { parseNeeds, needMet } from './npc-meters-config-parts/needs.js';
export { rung, normalizeMeterSettings, meterDefs } from './npc-meters-config-parts/settings.js';
export { thresholdReached, stageAt, parseMeterValue } from './npc-meters-config-parts/thresholds.js';
