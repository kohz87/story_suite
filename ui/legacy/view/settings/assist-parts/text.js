// The Assist page's module id, fold key, host keys and wording.

/** Story Block's module id, and the fold key of its Assist group, which `openSettings({ fold })` has always taken for these settings. */
export const ASSIST_MODULE = 'story-block';
export const ASSIST_FOLD = `${ASSIST_MODULE}::group:Assist`;
/** The host setting this page draws (the Story Suite fold no longer does). */
export const ASSIST_HOST_KEYS = Object.freeze(['callQueue', 'quickConnection', 'backgroundConnection']);

export const ASSIST_TEXT = Object.freeze({
    callsTitle: 'Extra calls',
    checksTitle: 'Checks',
    netTitle: 'Safety net',
    runsTitle: 'Recent runs',
    runsHint: 'what the helpers did lately',
    profile: 'Connection for quick helpers',
    preroll: 'Roll checks before the reply',
    net: 'Read changes the reply forgot',
    kinds: 'The safety net may write',
    kindsHelp: 'Pick the kinds of line it may add.',
    wall: 'Never coin, new items, XP, loot or healing. Those chips do not exist: the safety net never writes them, whatever is stored.',
    late: 'If it finishes after you have already sent your next message, its lines wait for the next reply and may not add anything new but someone arriving.',
    netOff: 'Off while the safety net is off',
    noFeatures: 'Not available here',
});
