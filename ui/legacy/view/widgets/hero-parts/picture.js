// The hero card's picture: safe URLs from the query, the pictures and the portrait, in the order to try.

import { safeImageUrl } from '../dom.js';

const QUERY_NAME = /^[a-z][a-zA-Z0-9_-]{0,39}(?:\.[a-zA-Z0-9_-]{1,40}){0,3}$/;

/** A picture's URL from a value that is a string or an answer `{ url }` / `{ src }`: a safe one, else ''. */
export function pictureUrl(value) {
    return safeImageUrl(typeof value === 'string' ? value : value?.url ?? value?.src ?? '');
}

/**
 * The pictures to try, in order, each a safe URL and once: the query's answer (`portraitQuery`), then `portraits`, then
 * `portrait`. A picture that fails to load is skipped by the widget (the next is tried), and the initial past the last.
 */
export function pictureCandidates(p, api) {
    const out = [];
    const add = value => { const url = pictureUrl(value); if (url && !out.includes(url)) out.push(url); };
    const name = typeof p.portraitQuery === 'string' ? p.portraitQuery : '';
    if (name && QUERY_NAME.test(name) && typeof api?.query === 'function') {
        try { add(api.query(name, p.portraitArgs && typeof p.portraitArgs === 'object' ? p.portraitArgs : undefined)); } catch {
            // The query is the host's to report; the card falls back to the next picture.
        }
    }
    for (const value of Array.isArray(p.portraits) ? p.portraits : []) add(value);
    add(p.portrait);
    return out;
}

/** The first picture to show (see pictureCandidates); '' for the initial. */
export function heroPicture(p, api) {
    return pictureCandidates(p, api)[0] ?? '';
}
