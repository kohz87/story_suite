// Whole-word phrase matching and the real link that draws someone toward the party.

import { atParty } from '../entries.js';

const fold = text => String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const noArticle = text => fold(text).replace(/^(?:the|a|an)\s+/, '');
/** Whether `text` holds `phrase` as whole words (an article in front of the phrase is left out; under four letters never). */
export const holds = (text, phrase) => {
    const want = noArticle(phrase);
    return want.length >= 4 && ` ${fold(text)} `.includes(` ${want} `);
};

/**
 * Why their goal really leads to the party, or '' (a word the goal or a drawn-to phrase shares with the scene is no link). `place`: the party's
 * place or region is a place their drawn-to phrases name; `thread`: an open thread (a secret never counts) names them, or one of their
 * phrases (their faction, a person they follow), in its key, giver or people; `carried`: a phrase is something the party carries.
 * `links`: `{ threads: [{ key, fields }], items: [name] }`.
 */
export function linkOf(item, party, { threads = [], items = [] } = {}) {
    const phrases = item.entry?.drawnTo ?? [];
    if (phrases.some(phrase => atParty(phrase, party))) return 'place';
    const own = [item.person.name, ...(Array.isArray(item.person.aliases) ? item.person.aliases : [])];
    for (const thread of threads) {
        const said = [thread.key, ...String(thread.fields?.giver ?? '').split(','), ...String(thread.fields?.people ?? '').split(',')];
        if (said.some(text => own.some(name => holds(text, name)) || phrases.some(phrase => holds(text, phrase)))) return 'thread';
    }
    if (items.some(name => phrases.some(phrase => noArticle(phrase) === noArticle(name) && noArticle(name).length >= 4))) return 'carried';
    return '';
}
