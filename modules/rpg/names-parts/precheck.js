// Names: the pre-check setting and its time limit.

/** The pre-check (board/precheck-run.js): Settings → RPG → Fight board "Set up a fight from my attack" (on unless set to false), and its time limit in ms. */
export const PRECHECK_SETTING = 'rpgPrecheck';
export const PRECHECK_LIMIT_MS = 20_000;
export const precheckOn = values => values?.[PRECHECK_SETTING] !== false;
