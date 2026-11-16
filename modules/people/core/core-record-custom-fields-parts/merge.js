/* Grounded merge of incoming custom-field values into the stored ones (keep-by-default, Level estimate from a quoted reason). */
import { normalizeCustomFieldNames, normalizeCustomFields } from './names.js';

function collapsedText(value) {
    return String(value ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

const LEVEL_QUOTE_MIN = 12; // collapsed characters: a few words, so one word cannot pass

// The reason is one string per row, so only the part after the word "Level" (up to another configured
// field's name) counts; its quoted text, or all of it when unquoted, must occur in the source text.
function levelQuoteInText(reason, configured, source) {
    const text = String(reason || '');
    const at = text.search(/\blevel\b/i);
    if (at < 0 || !source) return false;
    let tail = text.slice(at + 5);
    for (const other of configured) {
        if (other.toLowerCase() === 'level') continue;
        // A field marker is the name followed by a colon; a bare substring ("age" in "damage") must not cut a quote.
        const cut = tail.search(new RegExp(`(?<![\\p{L}\\p{N}])${other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'iu'));
        if (cut >= 0) tail = tail.slice(0, cut);
    }
    const quoted = [...tail.matchAll(/["\u201c]([^"\u201d]+)["\u201d]/g)].map(match => match[1]);
    return (quoted.length ? quoted : [tail]).some(part => {
        const quote = collapsedText(part);
        return quote.length >= LEVEL_QUOTE_MIN && source.includes(quote);
    });
}

// Keep-by-default: a configured field is set from the scan only when the source text carries the
// value, and an established value changes only with a stated reason. Omission keeps what is stored.
export function mergeCustomFieldValues(existing, incoming, { names = [], reason = '', context = '' } = {}) {
    const configured = normalizeCustomFieldNames(names);
    if (!configured.length) return null;
    const out = normalizeCustomFields(existing);
    const source = collapsedText(context);
    let changed = false;
    for (const [key, value] of Object.entries(normalizeCustomFields(incoming))) {
        const name = configured.find(item => item.toLowerCase() === key.toLowerCase());
        if (!name) continue;
        const storedKey = Object.keys(out).find(other => other.toLowerCase() === name.toLowerCase());
        const prior = storedKey ? out[storedKey] : '';
        if (prior && prior.toLowerCase() === value.toLowerCase()) continue;
        if (prior && !String(reason || '').trim()) continue;
        // Level may be an estimate from a stated rank or a comparison (owner-approved); the text then lacks
        // the value itself, so the reason must carry a quote from the story, written after the word "Level".
        const estimated = name.toLowerCase() === 'level' && levelQuoteInText(reason, configured, source);
        if (source && !estimated && !source.includes(collapsedText(value))) continue;
        if (storedKey && storedKey !== name) delete out[storedKey];
        out[name] = value;
        changed = true;
    }
    return changed ? out : null;
}
