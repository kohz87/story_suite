// What the reader's SillyTavern and a module say about the persona and the lead: the persona's file, the open card and a module's picture.

import { textOf } from './shared-reads.js';

// The persona thumbnail a user message or the persona list shows: `/thumbnail?type=persona&file=…` (SillyTavern's getThumbnailUrl).
const personaFileOfSrc = src => {
    try {
        const url = new URL(textOf(src), 'http://local.invalid');
        return url.pathname === '/thumbnail' && url.searchParams.get('type') === 'persona' ? textOf(url.searchParams.get('file')) : '';
    } catch { return ''; }
};

/**
 * The current persona's avatar file from the page, '' when none is found. SillyTavern 1.19's getContext() does not carry it
 * (`user_avatar` is personas.js's own state): the persona list marks the current persona's row `selected` (its
 * `data-avatar-id` is the file), and the newest user message shows the persona's picture unless it was given another one.
 */
export function personaFileOnPage(doc = globalThis.document) {
    try {
        const row = doc?.querySelector?.('#user_avatar_block .avatar-container.selected');
        const listed = textOf(row?.getAttribute?.('data-avatar-id') ?? row?.getAttribute?.('imgfile') ?? '');
        if (listed) return listed;
        const pictures = [...(doc?.querySelectorAll?.('.mes[is_user="true"] .avatar img') ?? [])];
        for (let i = pictures.length - 1; i >= 0; i -= 1) {
            const file = personaFileOfSrc(pictures[i]?.getAttribute?.('src') ?? '');
            if (file) return file;
        }
    } catch { /* no page here (a test, or SillyTavern not drawn yet): none */ }
    return '';
}

/**
 * What the reader's SillyTavern says about the persona and the open character: names and avatar files, '' for none.
 * The persona's file is the first of: the context's `user_avatar` (or SillyTavern's global),
 * the current persona on the page (personaFileOnPage), and the settings' default persona (power user's `default_persona`).
 */
export function readHeroContext(context = globalThis.SillyTavern?.getContext?.() ?? null, doc = globalThis.document) {
    let card = null;
    try {
        const id = context?.characterId;
        card = id != null && Array.isArray(context?.characters) ? context.characters[id] ?? null : null;
    } catch { card = null; }
    const fromContext = textOf(context?.user_avatar ?? context?.userAvatar ?? globalThis.user_avatar);
    return {
        personaName: textOf(context?.name1),
        personaFile: fromContext || personaFileOnPage(doc) || textOf(context?.powerUserSettings?.default_persona),
        cardName: textOf(card?.name),
        cardFile: textOf(card?.avatar),
    };
}

/** A module's picture answer: a string, or `{ url }` / `{ src }` (what a query may answer); '' for none. */
export function pictureOf(answer) {
    if (typeof answer === 'string') return textOf(answer);
    if (answer && typeof answer === 'object') return textOf(answer.url ?? answer.src ?? '');
    return '';
}
