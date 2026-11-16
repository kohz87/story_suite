// The story text Delta's scans and prompts read from the chat: recent windows, the current exchange
// (the latest reply and the user message it answers), the World State story day and the names that
// are never NPCs. (cleanup step 10) Moved out of index.js unchanged; index.js wires in the host's
// chat context and the Scan context setting once, with useTranscriptSource.
// Public face: re-exports its parts.
export { useTranscriptSource, currentExclusions } from './transcript-parts/source.js';
export { useMessageGate, refreshMessageGate, messageGateSettled, activeChat } from './transcript-parts/gate.js';
export { cleanMessage } from './transcript-parts/shared-clean.js';
export { recentTranscript, recentReplyIds, activeReplyIds, recentUserDevelopmentContext } from './transcript-parts/recent.js';
export { currentExchangeUserDevelopmentContext, currentExchangeMessages } from './transcript-parts/exchange.js';
export { skippedExchangesWindow } from './transcript-parts/skipped.js';
export { currentExchangeTranscript, currentExchangeBodies, currentExchangeProse } from './transcript-parts/exchange-text.js';
export { STORY_DAY_LOOKBACK, storyDayAt, tieDayAt, storyDaysForTranscript } from './transcript-parts/story-day.js';
