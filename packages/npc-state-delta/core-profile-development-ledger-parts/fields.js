// Profile-development field config (Personality/Speech ledger and baseline keys) and the ledger version.
export const PROFILE_DEVELOPMENT_VERSION = 2;

export const PROFILE_DEVELOPMENT_FIELDS = Object.freeze({
    personality: Object.freeze({ ledgerKey: 'personalityDevelopment', baselineKey: 'baselinePersonality' }),
    speech: Object.freeze({ ledgerKey: 'speechDevelopment', baselineKey: 'baselineSpeech' }),
});
