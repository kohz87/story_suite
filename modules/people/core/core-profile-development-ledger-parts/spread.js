// Personality/Speech spread thresholds: how many confirmations, story days, messages and turns count as development.
// A slow Personality/Speech change seen in two scenes far apart is development, not one scene's
// mood: a trend started by one grounded sighting needs only one confirmation once enough story time
// has passed. Dated World State measures story days; without dates, messages/turns stand in.
// Close together it still needs three.
export const PERSONALITY_SPREAD_READY_COUNT = 2;
export const DEVELOPMENT_SPREAD_MIN_DAYS = 7;
export const PERSONALITY_SPREAD_MIN_MESSAGES = 20;
export const PERSONALITY_SPREAD_MIN_TURNS = 10;
