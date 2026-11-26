// Whether the words of a `~ faction` line say the whole group is finished ("crew wiped out, one hand captured"). Pure; kept tight:
// a false "gone" deletes a faction, a miss only leaves it listed.

import { keyOf } from '../domain.js';

const GONE = /(?<![\p{L}\p{N}-])(?:wiped out|destroyed|disbanded|dissolved|broken up|annihilated|eliminated|exterminated|no longer exists|crushed and scattered)(?![\p{L}\p{N}-])/giu;
// The subject right before the phrase: a word for a whole group, besides the faction's own name.
const GROUPS = new Set(['group', 'gang', 'crew', 'band', 'guild', 'cell', 'company', 'ring', 'faction', 'cult', 'clan', 'syndicate', 'outfit', 'brotherhood', 'cartel', 'society', 'they']);
// Words that may stand between the subject and the phrase ("has now been completely wiped out"). Anything else ("not", "nearly") stops it.
const LINKS = new Set(['is', 'are', 'was', 'were', 'has', 'have', 'had', 'been', 'got', 'gets', 'now', 'finally', 'officially', 'completely', 'entirely', 'utterly', 'totally', 'effectively', 'all']);
// A clause that doubts it, or speaks of another group or of part of this one.
const DOUBT = /(?<![\p{L}\p{N}])(?:not|no one|never|nearly|almost|half|partly|partially|barely|if|unless|until|whether|would|could|should|might|may|will|shall|can|rumou?r(?:s|ed)?|claim(?:s|ed)?|reportedly|supposedly|allegedly|fears?|feared|wants?|wanted|plans?|planned|vow(?:s|ed)?|seeks?|sought|hopes?|hoped|threaten(?:s|ed)?|ordered|tried|to be|rivals?|enemy|enemies|another|other|some|several|part of|most of|one of|two|three)(?![\p{L}\p{N}])|n['’]t(?![\p{L}\p{N}])|\?/iu;
// What may follow the phrase. A noun or an object ("destroyed the bridge", "a destroyed wagon") means something else was.
const AFTER = /^(?:$|(?:by(?! (?:them|it|the group)(?![\p{L}]))|at|in|after|during|when|near|on|last|since|following|for good|completely|entirely|today|yesterday|tonight|overnight)(?![\p{L}\p{N}]))/iu;

// One of these before the phrase makes it a side remark ("buying their debts after the crew was wiped out"), not this line's news.
const ASIDE = /(?<![\p{L}\p{N}])(?:after|since|when|once|because|as|while|following|now that)(?![\p{L}\p{N}])/iu;

const wordsOf = text => text.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? [];

/**
 * Whether `text` (a line's words about the faction) says the faction is finished. `names`: its name and old names; `others`: those of
 * the other factions kept (a clause that names one may be about it).
 */
export function saysGone(text, names = [], others = []) {
    const padded = value => ` ${wordsOf(value).map(word => word.replace(/['’]s$/u, '')).join(' ')} `;
    const elsewhere = others.map(name => padded(keyOf(name))).filter(name => name.trim());
    const own = new Set(names.map(name => wordsOf(keyOf(name)).at(-1)).filter(Boolean));
    // Clauses end at punctuation; each is read alone.
    return String(text ?? '').split(/[.;:,!()—–]|\s-\s|(?<=\?)/u).some(clause => {
        const flat = clause.replace(/\s+/g, ' ').trim();
        if (DOUBT.test(flat) || elsewhere.some(name => padded(flat).includes(name))) return false;
        return [...flat.matchAll(GONE)].some(match => {
            if (!AFTER.test(flat.slice(match.index + match[0].length).trim())) return false;
            if (ASIDE.test(flat.slice(0, match.index))) return false;
            const before = wordsOf(flat.slice(0, match.index));
            while (before.length && LINKS.has(before.at(-1))) before.pop();
            const subject = before.at(-1);
            return subject === undefined || GROUPS.has(subject) || own.has(subject);
        });
    });
}
