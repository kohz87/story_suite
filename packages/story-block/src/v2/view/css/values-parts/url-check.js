// URL and script checks: which URLs a screen may load and why a declaration value is refused.

import { callArgs, decodeEscapes } from '../parse-parts/text.js';

/** True for a URL a screen may load: `https:` or `data:` (control characters and spaces ignored). */
export function isSafeCssUrl(url) {
    const flat = String(url).replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    return flat.startsWith('https:') || flat.startsWith('data:');
}

// Functions whose arguments the browser loads (url() is read on its own above). Their strings must be
// data:/https: URLs, and they may not take a value from var(), attr() or env(): a custom property can
// hold any URL as a plain string (`--a: "http://…"`), and `image-set(var(--a) 1x)` would load it.
const LOADERS = /(?:^|[^\w-])((?:-webkit-|-moz-)?(?:image-set|image|cross-fade|src|url))\s*\(/gi;
const STRING = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
// A quoted string that names a URL: a scheme with `//`, a protocol-relative `//`, or a scheme that loads
// or runs. Only data: and https: ones are kept, wherever they stand (custom properties included).
const URLISH = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/|(?:javascript|vbscript|livescript|data|blob|file|filesystem):)/i;

/**
 * Why a declaration value is refused, or '' when it is fine. Looks at the decoded value: script URLs,
 * `expression(`, `url()` that is not data:/https:, strings in `image-set()`/`image()`/`cross-fade()`/`src()`
 * that are not either, those functions fed from `var()`/`attr()`/`env()`, and any quoted URL that is not
 * data:/https: (so a custom property cannot carry one to a loader elsewhere).
 */
export function valueProblem(value) {
    const plain = decodeEscapes(String(value));
    const flat = plain.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    if (flat.includes('javascript:') || flat.includes('vbscript:')) return 'a script URL';
    if (flat.includes('expression(')) return 'expression()';
    if (/[<>]/.test(plain) && /<\/?style|<\/?script/i.test(plain)) return 'markup';
    for (const match of plain.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
        const url = match[1] ?? match[2] ?? match[3] ?? '';
        if (!isSafeCssUrl(url)) return `the URL "${url.trim().slice(0, 60)}"`;
    }
    if (/url\(/i.test(plain) && !/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/i.test(plain)) return 'an unclosed url(';
    for (const match of plain.matchAll(LOADERS)) {
        const name = match[1].toLowerCase();
        const args = callArgs(plain, match.index + match[0].length - 1);
        if (/(?:^|[^\w-])(?:var|attr|env)\s*\(/i.test(args)) return `${name}() fed from var(), attr() or env()`;
        for (const string of args.matchAll(STRING)) {
            const url = string[1] ?? string[2];
            if (!isSafeCssUrl(url)) return `the URL "${url.slice(0, 60)}"`;
        }
    }
    for (const string of plain.matchAll(STRING)) {
        const url = (string[1] ?? string[2]).replace(/[\u0000-\u0020\u007f]+/g, '');
        if (URLISH.test(url) && !isSafeCssUrl(url)) return `the URL "${url.slice(0, 60)}"`;
    }
    return '';
}
