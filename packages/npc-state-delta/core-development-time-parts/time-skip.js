/* NPC State Delta development time-skip detection: spots narrated time passage and bare "time passed" reasons. */

import { normalizeName } from '../core-text.js';

export function isBareTimePassageDevelopmentReason(value) {
    const text = normalizeName(value);
    if (!text) return true;
    if (/^(?:time|some time|a while|several years) (?:passed|elapsed)$/.test(text)) return true;
    return /^(?:(?:after|over|during) )?(?:the )?(?:next )?(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|several|many|few|\d+) (?:day|days|week|weeks|month|months|year|years|decade|decades)(?: later| passed| elapsed)?$/.test(text);
}

const DEVELOPMENT_DURATION_AMOUNT = String.raw`(?:\d+|a|an|couple|few|several|many|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)`;
const DEVELOPMENT_DURATION_UNIT = String.raw`(?:day|week|month|year|decade|season)s?`;
const DEVELOPMENT_DURATION_RE = new RegExp(`\\b${DEVELOPMENT_DURATION_AMOUNT}(?:\\s+${DEVELOPMENT_DURATION_AMOUNT})?\\s+${DEVELOPMENT_DURATION_UNIT}\\b`);
const DEVELOPMENT_QUALIFIED_DURATION_RE = new RegExp(`\\b(?:after|over|during|throughout|across|for|in|within|through)\\s+(?:the\\s+)?(?:(?:past|previous|last|next|preceding|following)\\s+)?(?:about\\s+|roughly\\s+|nearly\\s+|almost\\s+)?(?:${DEVELOPMENT_DURATION_AMOUNT}\\s+)?${DEVELOPMENT_DURATION_UNIT}\\b`);
const DEVELOPMENT_PAST_DURATION_RE = new RegExp(`\\b(?:past|previous|last)\\s+(?:about\\s+|roughly\\s+|nearly\\s+|almost\\s+)?(?:${DEVELOPMENT_DURATION_AMOUNT}\\s+)?${DEVELOPMENT_DURATION_UNIT}\\b`);
const DEVELOPMENT_BARE_DURATION_CONTEXT_RE = new RegExp(`\\b${DEVELOPMENT_DURATION_AMOUNT}(?:\\s+${DEVELOPMENT_DURATION_AMOUNT})?\\s+${DEVELOPMENT_DURATION_UNIT}\\s+(?:of|under|with|at|in)\\b`);

export function hasNarratedTimeSkip(value) {
    const text = normalizeName(value);
    if (!text) return false;
    return /\b(?:day|week|month|year|decade|season)s?\b[^.!?\n]{0,48}\b(?:pass|passed|elapse|elapsed|later|afterward|afterwards)\b/.test(text)
        || DEVELOPMENT_QUALIFIED_DURATION_RE.test(text)
        || DEVELOPMENT_PAST_DURATION_RE.test(text)
        || (DEVELOPMENT_BARE_DURATION_CONTEXT_RE.test(text) && !/\b(?:year|years)\s+of\s+age\b/.test(text))
        || /\b(?:months|years|weeks|days|seasons)\s+later\b/.test(text)
        || /\b(?:over|during|throughout|across)\s+(?:the\s+)?(?:spring|summer|autumn|fall|winter)(?:\s+(?:and|through|into)\s+(?:the\s+)?(?:spring|summer|autumn|fall|winter))?\b/.test(text)
        || /\b(?:spring|summer|autumn|fall|winter)\s+(?:through|into)\s+(?:the\s+)?(?:spring|summer|autumn|fall|winter)\b/.test(text)
        || (DEVELOPMENT_DURATION_RE.test(text) && /\b(?:time jump|time skip|elapsed|duration|period)\b/.test(text));
}
