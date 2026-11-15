/* NPC State Delta: the cheap local check whether a reply may change a dossier. */
import { text, norm } from './shared-text.js';
import { participationText, npcParticipatesInExchange } from './participation.js';

const NAME_STOP = new Set(['i', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'god', 'ok', 'okay', 'the', 'and', 'but', 'she', 'her', 'his', 'they', 'then', 'this', 'that', 'there', 'with', 'when', 'what', 'where', 'who', 'why', 'how', 'you', 'your', 'not', 'for', 'its', 'one', 'he', 'it', 'we', 'after', 'before', 'as', 'at', 'by', 'from', 'in', 'on', 'of', 'to', 'up', 'down', 'out', 'over', 'under', 'into', 'through', 'around', 'behind', 'beyond', 'while', 'if', 'though', 'although', 'because', 'since', 'until', 'so', 'yet', 'now', 'soon', 'later', 'again', 'still', 'just', 'only', 'even', 'perhaps', 'maybe', 'suddenly', 'slowly', 'quickly', 'finally', 'some', 'every', 'each', 'all', 'no', 'yes', 'nothing', 'something', 'everyone', 'someone', 'nobody', 'here', 'there', 'these', 'those', 'their', 'our', 'my', 'me', 'him', 'them', 'us', 'do', 'did', 'does', 'is', 'was', 'are', 'were', 'be', 'can', 'could', 'would', 'should', 'will', 'have', 'had', 'has', 'let', 'look', 'listen', 'well', 'oh', 'ah', 'hey', 'please', 'thank', 'thanks', 'sorry', 'good', 'morning', 'night', 'day', 'outside', 'inside', 'nearby', 'meanwhile', 'once', 'then', 'both', 'another', 'other', 'more', 'most', 'many', 'few', 'two', 'three', 'first', 'second', 'last', 'next', 'what', 'which', 'whose', 'whom', 'an', 'am', 'or', 'go', 'hi', 'us', 'if', 'oh', 'so', 'my']);
// Words that are also given names: a sentence-opening one followed by a person verb ("Will smiled") is a name.
const AMBIGUOUS_NAMES = new Set(['will', 'may', 'june', 'april', 'august', 'march', 'mark', 'rose', 'bill', 'grace', 'hope', 'faith', 'joy', 'pearl', 'ruby', 'dawn', 'summer', 'amber', 'iris', 'lily', 'holly', 'ivy', 'sue', 'pat', 'art', 'bob', 'jack', 'sage', 'river', 'storm']);
const PERSON_VERB = /^[ \t]+(?:said|says|asked|asks|replied|replies|nodded|nods|smiled|smiles|sighed|sighs|laughed|laughs|grinned|grins|frowned|frowns|shrugged|shrugs|whispered|whispers|muttered|mutters|stepped|steps|turned|turns|stood|stands|sat|sits|walked|walks|looked|looks|spoke|speaks|waved|waves|bowed|bows|shook|shakes|paused|pauses|hesitated|hesitates|glanced|glances|gasped|gasps|cried|cries|snorted|snorts|chuckled|chuckles)\b/iu;
// Scripts without capital letters: a name is told by what introduces or follows it, since the words are not spaced.
const CJK_ANY = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CJK_NAME = [
    /[\p{Script=Katakana}\u30fc]{2,}/gu,
    /[\p{Script=Han}]{1,4}(?=さん|ちゃん|くん|君|様|氏|殿|先生|という|と言う|と申|と呼|の名は)/gu,
    /(?:名叫|名为|名字是|名字叫|叫做|叫|姓)[\p{Script=Han}]{1,4}/gu,
    /[\p{Script=Han}]{1,3}(?=先生|小姐|女士|大人|殿下|姑娘|公子)/gu,
    /[\p{Script=Hangul}]{2,4}(?=씨|님|이라는|라는|이라고|라고)/gu,
];
// Other uncased scripts (Arabic, Hebrew, Indic, Thai ...): no cheap name test, so any such text is looked at.
const OTHER_UNCASED = /(?![\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Thai}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Georgian}\p{Script=Armenian}\p{Script=Ethiopic}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}]/u;
const CAP_WORD = /\p{Lu}[\p{L}\p{M}'\u2019-]*/gu;

/**
 * A cheap local check, no model call: may this reply change a dossier? It scans when the reply names a tracked NPC (by name or
 * alias), carries an NPC State line or names someone new. A capitalised word counts as a new name when it is not the first
 * word of a sentence (or is followed by another capitalised word) and no roster name, alias or `ignore` name (the player, the
 * character) contains it; names of two letters count; a common word that is also a given name counts before a person verb
 * ("Will smiled"); a name-like word of a script without capitals (CJK by what introduces it, other scripts by their
 * presence) counts too. A reply that only continues with a pronoun ("She sighs") is quiet here: the next scan reads every
 * reply since the last one, so nothing is lost, only the call is saved.
 */
export function replyMayChangeDossiers({ texts = [], roster = [], ignore = [] } = {}) {
    const source = (Array.isArray(texts) ? texts : [texts]).map(item => (typeof item === 'string' ? item : '')).filter(Boolean).join('\n');
    if (!text(source)) return false;
    if (/\bNPC State\b/i.test(source)) return true;
    const people = Array.isArray(roster) ? roster : [];
    if (people.some(npc => npc && typeof npc === 'object' && npcParticipatesInExchange(npc, people, source))) return true;
    const labels = [];
    const known = new Set(NAME_STOP);
    for (const label of [...ignore, ...people.flatMap(npc => [npc?.name, ...(npc?.aliases || [])])]) {
        const folded = norm(label);
        if (folded) labels.push(folded);
        for (const word of folded.split(' ')) if (word) known.add(word);
    }
    const prose = participationText(source);
    if (CJK_ANY.test(prose)) {
        // Words are not spaced: a tracked name is found inside the text, a new one by its introducer or honorific.
        const flat = prose.normalize('NFKC');
        if (labels.some(label => CJK_ANY.test(label) && flat.includes(label.replace(/ /g, '')))) return true;
        for (const pattern of CJK_NAME) {
            for (const match of flat.matchAll(pattern)) {
                const word = match[0].replace(/^(?:名叫|名为|名字是|名字叫|叫做|叫|姓)/u, '');
                if (word && !labels.some(label => label.replace(/ /g, '').includes(word))) return true;
            }
        }
    }
    if (OTHER_UNCASED.test(prose)) return true;
    for (const match of prose.matchAll(CAP_WORD)) {
        const word = norm(match[0]);
        if (word.length < 2) continue;
        const after = prose.slice(match.index + match[0].length);
        const before = prose.slice(0, match.index).replace(/[\s*_"'\u201c\u201d\u2018\u2019\u00ab(\[]+$/u, '');
        const initial = !before || /[.!?\u2026:\n\u2014>]$/u.test(before);
        if (known.has(word)) {
            // "Will smiled": a given name that is also a common word, opening a sentence before a person verb.
            if (AMBIGUOUS_NAMES.has(word) && initial && PERSON_VERB.test(after) && !labels.some(label => label.split(' ').includes(word))) return true;
            continue;
        }
        if (!initial) return true;
        // A sentence's first word is a name unless the same word also shows up in lower case in the text.
        if (!new RegExp(`(?:^|[^\\p{L}])${match[0].toLowerCase()}(?![\\p{L}])`, 'u').test(prose)) return true;
        const next = after.match(/^[ \t]+(\p{Lu}[\p{L}\p{M}'\u2019-]*)/u);
        if (next && !known.has(norm(next[1])) && norm(next[1]).length >= 2) return true;
    }
    return false;
}
