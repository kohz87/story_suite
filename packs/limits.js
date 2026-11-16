// Size limits and fixed word lists for packs (SPEC §9). One place, so the docs, the
// validator and the tests agree. Limits are generous for hand-made packs and small enough
// that a pack kept in settings.json (saved on every settings change) stays cheap.
// Public face: re-exports its parts.

export { LIMITS, RECORD_LIMITS, CONTENT_KINDS, OPTIONAL_KINDS } from './limits-parts/core.js';
export { YOU_FIELDS, YOU_RANK_FIELDS, YOU_RANK_LABEL_MAX, HOST_CAPABILITIES } from './limits-parts/host.js';
export { PACK_FIELDS, ECONOMY_FIELDS, ECONOMY_LIMITS, START_FIELDS } from './limits-parts/pack-fields.js';
export { ITEM_KINDS, RARITIES, ITEM_FIELDS, STAT_NAME } from './limits-parts/items.js';
export { ITEM_CARRY, ITEM_BONUS, ITEM_SOAK } from './limits-parts/item-bounds.js';
export { EVENT_FIELDS, EVENT_LIMITS, CHOICE_FIELDS } from './limits-parts/events.js';
export { SKILL_FIELDS, SKILL_TYPES, SKILL_TARGETS, PRESET_FIELDS } from './limits-parts/skills.js';
export { PLACE_FIELDS, ROUTE_FIELDS } from './limits-parts/map.js';
export { TERMS_FIELDS, TERMS_TIER_FIELDS, TERMS_NUMERALS, TERMS_LIMITS } from './limits-parts/terms.js';
export { TERM_SEPARATORS } from './limits-parts/term-separators.js';
export { NAMES_FIELDS, NAMES_LIMITS } from './limits-parts/names.js';
export { RANK_FIELDS, RANK_ID, RANKS_LIMITS } from './limits-parts/ranks.js';
export { MARKET_FIELDS, MARKET_LIMITS, MARKET_WORD } from './limits-parts/markets.js';
export { RECIPE_CRAFT_FIELDS, RECIPE_LIMITS, STAT_SUM, STATIONS } from './limits-parts/recipes.js';
export { DEFAULT_CRAFTS, CRAFT_FIELDS, CRAFTS_LIMITS } from './limits-parts/crafts.js';
export { METER_PRESET_FIELDS, METER_FIELDS, METER_STAGE_FIELDS, METER_LIMITS } from './limits-parts/meters.js';
export { LEAN_RPG_FIELDS, SKILL_SET_FIELDS, SKILL_SET_SKILL_FIELDS, LEAN_RPG_LIMITS } from './limits-parts/rpg-skill-sets.js';
export { RPG_RANK_FIELDS, RPG_RANK_LIMITS, RPG_PLAYER_RANK_FIELDS, RPG_PLAYER_RANK_LIMITS } from './limits-parts/rpg-ranks.js';
export { RPG_FORMULAS, RPG_NUMBER_KEYS } from './limits-parts/rpg-rules.js';
export { CAST_FIELDS, CAST_START_FIELDS, CAST_SECRET_FIELDS, CAST_LIMITS } from './limits-parts/cast.js';
export { CAST_SKILL_FIELDS, CAST_SKILL_STATS, CAST_SKILL_USES, CAST_SKILL_TYPES } from './limits-parts/cast-skills.js';
export { CAST_SKILL_RANK_WORDS, CAST_BEHAVIOUR_LEVERS, CAST_BEHAVIOUR_LEVELS } from './limits-parts/cast-behaviour.js';
export { CAST_BUILT_IN_METERS, CAST_BUILT_IN_PRESETS, METER_RESERVED } from './limits-parts/cast-meters.js';
export { PORTRAIT_LIMITS, PORTRAIT_NAME } from './limits-parts/portraits.js';
export { ZIP_LIMITS } from './limits-parts/zip.js';
export { CALENDAR_FIELDS, CALENDAR_HOLIDAY_FIELDS, CALENDAR_START_FIELDS, CALENDAR_LIMITS } from './limits-parts/calendar.js';
export { WEATHER_FIELDS, WEATHER_SEASON_FIELDS, WEATHER_TABLE_FIELDS, WEATHER_LIMITS } from './limits-parts/weather.js';
export { RIPPLES_FIELDS, RIPPLES_POWER_FIELDS, RIPPLES_TIERS, RIPPLES_CAPS } from './limits-parts/ripples.js';
export { RIPPLES_LIMITS } from './limits-parts/ripples-limits.js';
export { SCREEN_FIELDS, TAB_ID, TAB_TITLE_MAX, MOUNTS } from './limits-parts/screens.js';
export { PACK_ID, SLUG, SEMVER, COMMAND } from './limits-parts/ids.js';
export { DEF_ID, SCREEN_ID } from './limits-parts/refs.js';
