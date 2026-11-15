// Extracting name-free calling and lead descriptions for a cast entry.

import { cutWords, flat } from '../domain.js';
import { nameTester } from './names.js';

const sentencesOf = text => String(text ?? '').split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(Boolean);

/** What the entry's `about` says of who they are: the opening noun phrase of its first sentence with no name (up to the first `:`, `,` or `;`, no article). */
export function leadOf(entry, mentions = nameTester(entry)) {
    for (const sentence of sentencesOf(entry?.about)) {
        // Only this opening phrase is ever used, so it is the phrase that must not carry a name (a common word of the sentence elsewhere may).
        const phrase = sentence.split(/[:,;]/)[0].trim().replace(/^(?:the|a|an)\s+/i, '').replace(/[.!?]+$/, '');
        // A lone adjective or a pair of them ("Proud", "Stoic and tired") says nothing about who someone is.
        if (mentions(sentence.split(/[:,;]/)[0]) || phrase.split(/\s+/).length < 3 || /^\S+ and \S+$/i.test(phrase)) {
            if (mentions(sentence)) continue;
            return '';
        }
        return cutWords(phrase, 70);
    }
    return '';
}

/** The words a person is sought by: their calling and the lead of their `about` (name-free). */
export function kindWords(entry) {
    const mentions = nameTester(entry);
    // Each part of a calling that carries a name-like word is left out on its own ("Saintess candidate, healer" for an alias "Last Candle" keeps "healer").
    const calling = flat(entry?.calling).split(/\s*[,;]\s*/).filter(part => part && !mentions(part)).join(', ');
    return { calling, lead: leadOf(entry, mentions) };
}
