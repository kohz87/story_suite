/* NPC State Delta finding the sentences of a text that are about one NPC and the NPC name labels. */

// Sentences that are about this NPC: they name it as a whole word (name, alias or distinctive
// first name), plus a directly following sentence that continues with a pronoun.
export function npcOwnedSentences(npc, text) {
    const labels = [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])].map(label => String(label || '').trim()).filter(Boolean);
    const words = [...labels, ...labels.map(label => label.split(/\s+/)[0]).filter(token => token.length >= 3)];
    const patterns = [...new Set(words)].map(word => new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu'));
    // Markup blocks (<World_State> ...) are separate statements, not part of the next sentence.
    const sentences = String(text || '').split(/(?<=[.!?])\s+|\n+|<\/?[A-Za-z_][^>]*>/).map(item => item.trim()).filter(Boolean);
    const owned = [];
    sentences.forEach((sentence, index) => {
        if (patterns.some(pattern => pattern.test(sentence))) owned.push(sentence);
        else if (index > 0 && owned.includes(sentences[index - 1])
            && /^(?:(?:then|now|later|soon|afterwards?|finally),?\s+)?(?:she|he|they|her|his|their)\b/i.test(sentence)) owned.push(sentence);
    });
    return owned;
}

const CLAUSE_STARTERS = new Set(['the', 'then', 'she', 'he', 'they', 'her', 'his', 'their', 'it', 'today', 'tomorrow', 'yesterday',
    'on', 'in', 'at', 'when', 'after', 'before', 'as', 'if', 'but', 'and', 'so', 'now', 'later', 'this', 'that', 'there', 'here',
    'a', 'an', 'once', 'soon', 'still', 'meanwhile', 'everyone', 'nobody', 'someone']);

// A clause whose subject is a named person other than this NPC ("Noela Far is not here",
// "Noela was born in CR790", "Noela celebrates her birthday") is about that person.
export function foreignSubjectClause(clause, own) {
    const lead = String(clause || '').trim().match(/^((?:\p{Lu}[\p{L}\p{M}'’-]*\s+){1,3})(?=\p{Ll})/u)?.[1];
    if (!lead) return false;
    const tokens = lead.trim().split(/\s+/).map(token => token.replace(/['’]s$/i, '').toLowerCase());
    if (CLAUSE_STARTERS.has(tokens[0])) return false;
    return !tokens.some(token => own.has(token));
}

export function npcFirstLabels(npc) {
    const labels = [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])].map(label => String(label || '').trim()).filter(Boolean);
    return new Set([...labels, ...labels.map(label => label.split(/\s+/)[0])].map(label => label.toLowerCase()));
}
