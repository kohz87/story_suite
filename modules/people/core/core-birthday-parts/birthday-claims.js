/* NPC State Delta recognising own-birthday claims in narration and grounding a scanned birth date. */
import { normalizeBirthDate } from '../../birthday/birthday.js';
import { normalizeCalendarDate } from '../../legacy/calendar.js';
import { npcOwnedSentences, foreignSubjectClause, npcFirstLabels } from './owned-text.js';

const NEGATED_BEFORE = /\b(?:not|never|isn['’]?t|wasn['’]?t|no longer)\s+(?:\w+\s+){0,3}$/i;
const BIRTH_PREDICATE = /\b(?:birth(?:day|date)?|name\s*day|nameday|born|hatched|date\s+of\s+birth)\b/giu;
const CURRENT_BIRTHDAY = /\b(?:birthday|name\s*day|nameday|turn(?:s|ing)?\s+\d{1,3})\b/giu;
const HYPOTHETICAL_OR_FALSE = /\b(?:if|would|might|could|perhaps|maybe|supposedly|allegedly|forged|forgery|fake|false|lie|lies|lied|rumou?rs?|pretend(?:s|ed|ing)?|claims?\s+(?:to|that)|as if|denies|denied|deny|doubts?|doubted|whether|wonders?|wondered)\b/i;
const PAST_BIRTHDAY = /\b(?:yesterday|tomorrow|last\s+(?:year|week|month)|next\s+birthday|upcoming|ago|earlier|previous|past|recounts?|recounted|recalls?|recalled|remembers?|remembered|was\s+(?:her|his|their)\s+birthday|had\s+(?:her|his|their)\s+birthday|will\s+be)\b/i;

// The part of a sentence that speaks about this NPC: another named person's possessive
// ("Noela's birthday"), a "Noela, who ..." relative clause and another person's "Noela turns 18"
// belong to that person and are removed.
function npcOwnClaimText(npc, sentence) {
    const own = npcFirstLabels(npc);
    const foreign = name => !own.has(String(name || '').toLowerCase());
    const ownClauses = String(sentence || '').split(/(?<=[,;])\s*|\s+(?=(?:but|while|whereas|and then|because)\b)/i)
        .filter(clause => !foreignSubjectClause(clause, own)).join(' ');
    return ownClauses
        .replace(/\b(\p{Lu}[\p{L}\p{M}-]+),?\s+who\b.*$/u, (match, name) => (foreign(name) ? ' ' : match))
        .replace(/\b(\p{Lu}[\p{L}\p{M}-]+)['’]s\s+(?:birthday|name\s*day|nameday|birth)\b/gu, (match, name) => (foreign(name) ? ' ' : match))
        .replace(/\b(\p{Lu}[\p{L}\p{M}-]+)\s+turn(?:s|ing)?\s+\d{1,3}\b/gu, (match, name) => (foreign(name) ? ' ' : match));
}

function affirmativeMatch(text, pattern) {
    for (const match of String(text || '').matchAll(pattern)) {
        if (!NEGATED_BEFORE.test(text.slice(0, match.index))) return true;
    }
    return false;
}

// Affirmative narration that today is this NPC's own birthday (not a denial, question,
// hypothetical, past birthday or someone else's).
function ownCurrentBirthdayClaim(npc, sentence) {
    const text = npcOwnClaimText(npc, sentence);
    if (/\?\s*$/.test(text) || HYPOTHETICAL_OR_FALSE.test(text) || PAST_BIRTHDAY.test(text)) return false;
    return affirmativeMatch(text, CURRENT_BIRTHDAY);
}

// An affirmative statement of this NPC's own birth (born / birthday / date of birth).
function ownBirthClaim(npc, sentence) {
    const text = npcOwnClaimText(npc, sentence);
    if (/\?\s*$/.test(text) || HYPOTHETICAL_OR_FALSE.test(text)) return '';
    return affirmativeMatch(text, BIRTH_PREDICATE) ? text : '';
}

export function npcBirthdayNarrated(npc, text) {
    return npcOwnedSentences(npc, text).some(sentence => ownCurrentBirthdayClaim(npc, sentence));
}

function statedInSentence(sentence, token) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:st|nd|rd|th)?(?![\\p{L}\\p{N}])`, 'giu');
    for (const match of sentence.matchAll(pattern)) {
        if (!NEGATED_BEFORE.test(sentence.slice(0, match.index))) return true;
    }
    return false;
}

// A scanned birth date may set or change chronology only when an affirmative statement of this
// NPC's own birth supports every part it supplies: the month and day (stated, or "today is her
// birthday" on today's date) and a new year, none of them negated. The parts may be split across
// two consecutive sentences about the NPC ("Mira was born in CR790. Her birthday is Redleaf 2.").
// Callers without source text (manual edits) are not checked.
export function birthdayUpdateGrounded(npc, update, sourceText, calendar, referenceDate = null) {
    const text = String(sourceText || '');
    if (!text.trim()) return true;
    const incoming = normalizeBirthDate(update?.birthDate ?? update?.birth_date ?? update?.birthday, calendar);
    if (!incoming) return true;
    const known = normalizeBirthDate(npc?.birthDate, calendar);
    const reference = referenceDate ? normalizeCalendarDate(referenceDate, calendar) : null;
    const isToday = reference && String(reference.month).toLowerCase() === String(incoming.month).toLowerCase() && Number(reference.day) === Number(incoming.day);
    const needsYear = incoming.year !== null && !(known && known.year === incoming.year);
    const sentences = String(text).split(/(?<=[.!?])\s+|\n+|<\/?[A-Za-z_][^>]*>/).map(item => item.trim()).filter(Boolean);
    const owned = new Set(npcOwnedSentences(npc, text));
    const claims = sentences.map(sentence => (owned.has(sentence) ? ownBirthClaim(npc, sentence) : ''));
    const era = String(incoming.era || calendar?.era || '').trim();
    const yearTokens = [String(incoming.year), era && `${era}${incoming.year}`, era && `${era} ${incoming.year}`].filter(Boolean);
    const supports = window => {
        const dated = window.some(claim => statedInSentence(claim, incoming.month)) && window.some(claim => statedInSentence(claim, Number(incoming.day)));
        const birthdayToday = isToday && window.some(claim => ownCurrentBirthdayClaim(npc, claim));
        if (!dated && !birthdayToday) return false;
        return !needsYear || window.some(claim => yearTokens.some(token => statedInSentence(claim, token)));
    };
    return claims.some((claim, index) => claim && (supports([claim]) || (claims[index + 1] && supports([claim, claims[index + 1]]))));
}
