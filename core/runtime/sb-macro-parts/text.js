// Turns `{{sb::path|fallback}}` into the text of that path of the public API.
import { plainText } from '../public-api.js';
import { defuseMacros } from '../turn.js';
import { cutAt } from '../../text.js';
import { MACRO_MAX } from './names.js';

/**
 * The text of `{{sb::<raw>}}` for the api: `raw` is "path" or "path|fallback". A path with no text (missing, hidden, empty, an object) gives
 * the fallback, or nothing without one.
 */
export function macroText(api, raw) {
    // `path|fallback` and `path::fallback` (the safe form: SillyTavern's engine reads `|` in a few places of its own); the first of the two splits.
    const text = String(raw ?? '');
    const found = [text.indexOf('|'), text.indexOf('::')].filter(at => at >= 0).sort((a, b) => a - b)[0];
    const path = (found === undefined ? text : text.slice(0, found)).trim();
    const fallback = found === undefined ? '' : text.slice(found + (text.startsWith('::', found) ? 2 : 1)).trim();
    let value = null;
    try { value = plainText(api.get(path)); } catch { value = null; }
    if (value === null) return fallback;
    // Cut after defusing, so the result is at most MACRO_MAX characters.
    return cutAt(defuseMacros(value), MACRO_MAX);
}
