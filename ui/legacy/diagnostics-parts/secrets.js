// Removing secrets from text: secret keys, key-like values, quoted words, and a log line made safe.
import { cutAt } from '../../../../../core/text.js';

// A settings key holding any of these words (split at camelCase, _, -, .) is left out whole.
const SECRET_WORDS = new Set(['key', 'keys', 'apikey', 'secret', 'secrets', 'password', 'passwd', 'pwd', 'pass', 'passphrase', 'token',
    'auth', 'authorization', 'credential', 'credentials', 'cookie', 'cookies', 'bearer', 'endpoint', 'url', 'uri', 'session', 'private']);
const wordsOf = key => String(key ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** True when a settings key names a secret (apiKey, auth_token, endpointUrl, password…); "maxTokens" is not one. */
export function isSecretKey(key) {
    const words = wordsOf(key);
    return words.some(word => SECRET_WORDS.has(word)) || /api_?key/i.test(String(key ?? ''));
}

// Text that looks like a secret or an address: replaced whole.
const SECRET_VALUE = [
    /\b[a-z][a-z0-9+.-]*:\/\/\S+/i,                    // an address (http://, wss://…), with whatever it carries
    /\bbearer\s+\S+/i,
    /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/,               // sk-…, pk-…, rk-… keys, short ones too (B-a3-3)
    /\b(?:xox[abpr]-|gh[pousr]_|glpat-|AIza)[A-Za-z0-9_-]{16,}/,
    /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA)[0-9A-Z]{16}\b/,   // an AWS access key id
    /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]*)?/,  // a JWT ("eyJ" is '{"' in base64)
    /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,  // JWT-like: three long dotted parts
    /\b(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{40,}={0,2})\b/,     // a long key-like run
    /\b(?:api[_-]?key|token|secret|password|passwd|auth)\s*[:=]\s*\S+/i,
];
// A long run of letters and digits with both in it ("Xq7Lm2Pz9Rt4…", most providers' keys): replaced. Found
// as a run, then tested, so a long run costs its length once (no lookahead tried from every place).
const KEY_RUN = /[A-Za-z0-9_-]{20,}/g;
const keyLike = run => /\d/.test(run) && /[A-Za-z]/.test(run);
export const REMOVED = '[removed]';

/** `text` with anything that looks like a secret or an address replaced (the rest kept). */
export function scrubSecrets(text) {
    let out = String(text ?? '');
    for (const pattern of SECRET_VALUE) out = out.replace(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`), REMOVED);
    return out.replace(KEY_RUN, run => (keyLike(run) ? REMOVED : run));
}


// Quote marks that start or end a run of a reply's words.
const QUOTE_MARK = /["“”«»„]/;

// From the first quote mark on a line to its last one, the line's quoted text (the reply's words) goes,
// only its length kept, so a quote mark inside a quoted name ('"Bob's "Lucky" mug"') leaves nothing of it
// between (B-a3-2). A quote mark with no other after it: the rest of the line goes.
function unquote(flat) {
    const marks = [...flat.matchAll(new RegExp(QUOTE_MARK.source, 'g'))];
    if (!marks.length) return flat;
    const first = marks[0].index;
    const last = marks.length > 1 ? marks.at(-1).index + 1 : flat.length;
    const inner = [...flat.slice(first + 1, marks.length > 1 ? last - 1 : last)].length;
    return `${flat.slice(0, first)}"[${inner} characters]"${flat.slice(last)}`;
}

/** A log line made safe: no quoted text (its length instead), no secrets, one line, at most `max` characters. */
export function scrubLine(text, max = 300) {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
    return cutAt(scrubSecrets(unquote(flat)), max);
}
