/* Accepts a scan's secret-event keys only when each carries an evidence quote found in the story text. */
// Lowercase letters and digits only: curly quotes, dashes, spacing and other punctuation never decide a match.
const quoteForm = text => String(text ?? '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');
const QUOTE_MIN = 8;   // fewer letters than this is not a quote

/**
 * The keys of a scan's `secretEvents` that are backed up: each needs a `secretEventEvidence` quote in the story text the scan
 * read (user message + reply, or the window of a targeted pass), compared without case, spacing or punctuation; "..." in a
 * quote joins parts that each must be found. A key with no quote, a short one or one not in the text is refused (debug log),
 * so its note stays closed. `parsed` is the scan answer; returns the accepted keys.
 */
export function secretEventsShown(parsed, text) {
    const keys = Array.isArray(parsed?.secretEvents) ? parsed.secretEvents.map(item => String(item ?? '')) : [];
    const evidence = parsed?.secretEventEvidence && typeof parsed.secretEventEvidence === 'object' ? parsed.secretEventEvidence : {};
    const haystack = quoteForm(text);
    return keys.filter(key => {
        const quote = evidence[key];
        const parts = typeof quote === 'string' ? quote.split(/\.{3}|\u2026/).map(quoteForm).filter(Boolean) : [];
        const shown = parts.length > 0 && parts.join('').length >= QUOTE_MIN && parts.every(part => haystack.includes(part));
        if (!shown) console.debug(`[NPC State Delta] story event ${key} refused: ${typeof quote === 'string' && quote ? 'its quote is not in the exchange' : 'no evidence quote'}.`);
        return shown;
    });
}
