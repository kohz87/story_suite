/* NPC State Delta speech attribution: keeps only affirmative clauses owned by this NPC, and vetoes borrowed voices. */

import { normalizeName } from '../core-text.js';
import { durableRefinementTokens } from '../core-relationship.js';
import { developmentBindingLabels, developmentContextSegments } from '../core-durable-episodes.js';

// Voice evidence must describe this NPC affirmatively. Each sentence is split into clauses and each
// clause attributed: to whoever it names first, a "who/whose" clause to the person named just before
// it ("Mira, who speaks warmly" is Mira's; "listens to Noela, who speaks warmly" is Noela's), a
// "her mother ..." subject to someone else, and an unnamed clause to the clause before it. Clauses
// owned by another person, hypothetical clauses ("if she spoke ...") and negated predicates
// ("does not / neither ... nor / denies speaking warmly") are dropped. Unattributed text such as a
// "Voice:" line or "she said softly" is kept, so ordinary attributed dialogue still counts.
const NEGATED_CLAIM_RE = /\b(?:not|never|hardly|rarely|no longer|without|neither|nor|denies|denied|deny|refuses?|refused|[a-z]+n t)\b[^,;]*?(?=\s+but\b|[,;]|$)/g;
const HYPOTHETICAL_CLAIM_RE = /\b(?:if|unless|would|might|could|wishes|wished|imagines?|imagined|pretends?|pretended)\b/;
const FOREIGN_KIN_SUBJECT_RE = /^(?:her|his|their|the)\s+(?:mother|father|sister|brother|aunt|uncle|friend|husband|wife|son|daughter|master|mistress|companion|cousin|grandmother|grandfather|parent|child|children|teacher|mentor|captain|innkeeper|stranger|guard|servant|maid)\b/;
const CLAUSE_SPLIT_RE = /\s*[,;:]\s*|\s+(?=(?:while|whereas|but|because|although|though|and then)\b)/i;

export function affirmativeOwnClaimText(text, binding = null) {
    const otherLabels = [
        ...(Array.isArray(binding?.otherLabels) ? binding.otherLabels : []),
        ...(Array.isArray(binding?.speechOtherLabels) ? binding.speechOtherLabels : []),
    ].map(normalizeName).filter(Boolean);
    const targetLabels = developmentBindingLabels(binding);
    const targetTokens = new Set(targetLabels.flatMap(label => label.split(/\s+/)));
    const positions = (normalized, labels) => labels.flatMap(label => {
        const found = [];
        let at = normalized.indexOf(` ${label} `);
        while (at >= 0) { found.push(at); at = normalized.indexOf(` ${label} `, at + 1); }
        return found;
    });
    return developmentContextSegments(text).map(sentence => {
        let owner = null;
        let lastNamed = null;
        const kept = [];
        for (const raw of sentence.split(CLAUSE_SPLIT_RE).map(part => String(part || '').trim()).filter(Boolean)) {
            const normalized = ` ${normalizeName(raw)} `;
            const own = positions(normalized, targetLabels);
            const other = positions(normalized, otherLabels);
            // Capitalized names after the clause start that are not this NPC count as someone else.
            const capitalized = [...raw.matchAll(/(?<=\s)\p{Lu}[\p{L}\p{M}'’-]+/gu)].map(match => normalizeName(match[0]));
            const strangerNamed = capitalized.some(token => token && !targetTokens.has(token) && !other.length);
            let clauseOwner;
            if (/^(?:who|whose|which)\b/i.test(raw)) clauseOwner = lastNamed;
            else if (FOREIGN_KIN_SUBJECT_RE.test(normalized.trim())) clauseOwner = 'other';
            else if (own.length || other.length) {
                const firstOwn = own.length ? Math.min(...own) : Infinity;
                const firstOther = other.length ? Math.min(...other) : Infinity;
                clauseOwner = firstOwn < firstOther ? 'target' : 'other';
                if (clauseOwner === 'target' && targetLabels.some(label => new RegExp(`\\b${label}\\s+s\\s+(?:mother|father|sister|brother|friend|husband|wife|son|daughter|master|companion|cousin)\\b`).test(normalized))) clauseOwner = 'other';
            } else clauseOwner = owner;
            const lastOwn = own.length ? Math.max(...own) : -1;
            const lastOther = other.length ? Math.max(...other) : -1;
            if (lastOwn >= 0 || lastOther >= 0) lastNamed = lastOther > lastOwn ? 'other' : 'target';
            if (strangerNamed) lastNamed = 'other';
            if (clauseOwner) owner = clauseOwner;
            if (clauseOwner === 'other' || HYPOTHETICAL_CLAIM_RE.test(normalized)) continue;
            kept.push(normalized.replace(NEGATED_CLAIM_RE, ' ').replace(/\s+/g, ' ').trim());
        }
        return kept.filter(Boolean).join(' ');
    }).filter(Boolean).join(' ');
}

const GENERIC_VOICE_WORDS = new Set(['speak', 'speaks', 'spoke', 'speaking', 'speech', 'voice', 'voiced', 'talk', 'talks', 'talking', 'say', 'says', 'said', 'tone', 'words', 'sentences']);

// Whether a proposed voice is borrowed from text that is not this NPC's affirmative voice: some of
// its words occur in the narration, but only inside another person's or a negated clause.
export function speechSeedVetoed(value, context = '', binding = null) {
    const raw = String(context || '').trim();
    if (!raw) return false;
    const rawTokens = new Set(durableRefinementTokens(raw));
    const ownTokens = new Set(durableRefinementTokens(affirmativeOwnClaimText(raw, binding)));
    return [...new Set(durableRefinementTokens(value))]
        .filter(token => token.length >= 3 && !/^\d+$/.test(token) && !GENERIC_VOICE_WORDS.has(token))
        .some(token => rawTokens.has(token) && !ownTokens.has(token));
}

export function speechSupportContext(context = '', binding = null) {
    const raw = String(context || '').trim();
    return raw ? affirmativeOwnClaimText(raw, binding) : '';
}
