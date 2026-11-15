/* NPC State Delta development cues and user-canon checks: batch cue pattern, declarative user lines and explicit context grounding. */

import { cleanText, normalizeName } from '../core-text.js';
import { developmentContextSegments } from '../core-durable.js';
import { contextWindowGroundsReason } from './reason-grounding.js';

const EXPLICIT_DEVELOPMENT_CUE_RE = /\b(?:no longer|formerly|used to|ceased|stopped being|became|become|grown|grew|increasingly|decreasingly|changed|from then on|henceforth|ever since|second nature|true nature|habitual|habitually|permanent|permanently|lasting|now (?:always|usually|routinely|consistently|more|less)|contrary to|actually|in fact|has always|had always|never was|never had been|mistaken|misunderstood)\b/;
export const BATCH_DEVELOPMENT_CUE_RE = /\b(?:gradually|repeatedly|consistently|routinely|throughout|eventually|over time|during that time|by then|became|become|grown|grew|learn(?:ed|ing|s)?|practic(?:ed|ing)|practis(?:ed|ing)|progress(?:ed|ing|ion)|develop(?:ed|ing|ment)|improv(?:ed|ing|ement)|train(?:ed|ing)|stud(?:y|ies|ied|ying)|apprentice(?:d|ship)?|school(?:ing|ed)?|education|master(?:ed|ing)|lesson(?:s)?|taught|teaching|coach(?:ed|ing)|mentor(?:ed|ing)|adopt(?:ed|ing)|replac(?:ed|ing)|discard(?:ed|ing)|transition(?:ed|ing)|shift(?:ed|ing)|habitual|second nature|true nature|chang(?:e|ed|es|ing))\b/;

const USER_CANON_NONDECLARATIVE_RE = /^(?:m\d+\s+)?(?:["'“‘]|(?:i|we)\s+(?:wonder|wish|want|hope|ask|suggest|imagine|think|guess|suppose)|(?:please|let(?:'s| us)|maybe|perhaps|possibly|could|would|should|might|what if|if only|can you|could you|would you|make\b|have\b))/i;
const USER_CANON_SPECULATIVE_RE = /\b(?:maybe|perhaps|possibly|might|could become|would become|should become|may become|i wonder|i think|i guess|i suppose|i hope|i want|i wish)\b/i;

export function declarativeUserDevelopmentSegment(segment) {
    const source = cleanText(segment, 1200);
    if (!source || /\?\s*$/.test(source)) return false;
    const body = source.replace(/^\[m\d+\]\s*/i, '').replace(/^[^:]{1,80}:\s*/, '').trim();
    if (!body || USER_CANON_NONDECLARATIVE_RE.test(normalizeName(body)) || USER_CANON_SPECULATIVE_RE.test(normalizeName(body))) return false;
    // A line that is entirely quoted speech is dialogue, not narrator/player canon.
    const quoted = body.match(/^(?:["“‘'])([\s\S]*)(?:["”’'])$/);
    if (quoted) return false;
    return true;
}

export function explicitDevelopmentContextGrounded(reason, context, { requireDeclarativeUser = false } = {}) {
    const source = String(context || '').trim();
    if (!source) return true;
    return developmentContextSegments(source).some(segment => {
        if (requireDeclarativeUser && !declarativeUserDevelopmentSegment(segment)) return false;
        return EXPLICIT_DEVELOPMENT_CUE_RE.test(normalizeName(segment))
            && contextWindowGroundsReason(reason, segment);
    });
}
