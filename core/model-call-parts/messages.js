// The error codes and plain sentences a model call answers with.

export const MODEL_CALL_ERRORS = Object.freeze({
    FEATURE_OFF: 'FEATURE_OFF',
    BUSY: 'BUSY',
    TIMEOUT: 'TIMEOUT',
    ABORTED: 'ABORTED',
    BAD_REQUEST: 'BAD_REQUEST',
    NO_PROFILE: 'NO_PROFILE',
    UNAVAILABLE: 'UNAVAILABLE',
    EMPTY: 'EMPTY',
    FAILED: 'FAILED',
});

export const MODEL_CALL_TEXT = Object.freeze({
    featureOff: 'The feature "{feature}" is turned off, so its model call was not made.',
    busy: '{module} already has a model call on its way; this one was not made.',
    timeout: 'The model did not answer within {seconds} s.',
    aborted: 'The model call was cancelled.',
    noPrompt: 'A model call needs a prompt (text).',
    noSystem: 'A model call\'s system text must be text.',
    unavailable: 'Model calls are not available here.',
    empty: 'The model answered with nothing.',
    failed: 'The model call failed: {why}',
    noSt: 'SillyTavern is not available.',
    noRaw: 'This SillyTavern cannot make a separate model call (no generateRaw).',
    cmOff: 'Connection Profiles is turned off in SillyTavern\'s extensions, so the profile "{name}" cannot be used.',
    noCm: 'This SillyTavern has no Connection Manager, so the profile "{name}" cannot be used.',
    noProfile: 'There is no connection profile called "{name}" in SillyTavern\'s Connection Manager.',
    listCmOff: 'Connection Profiles is turned off in SillyTavern\'s extensions, so every call uses the chat\'s connection.',
    listNoCm: 'This SillyTavern has no Connection Manager, so every call uses the chat\'s connection.',
});
