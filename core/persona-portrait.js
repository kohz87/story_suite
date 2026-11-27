// The reader's persona picture for plug-ins: the `persona.portrait` query's reading of SillyTavern's live context (a query only: nothing is stored, so a replay does not meet it).
import { isSafePortraitUrl } from '../ui/kit/safe-url.js';

/** `personaPortrait(ctx)` → the persona avatar's URL (`/User%20Avatars/<file>`) when `ctx` names one and the URL is safe in a CSS url(), else null. Never throws. */
export function personaPortrait(ctx) {
    try {
        const map = ctx?.powerUserSettings?.personas ?? {};
        const named = ctx?.name1 ? Object.keys(map).filter(key => map[key] === ctx.name1) : [];
        const file = typeof ctx?.user_avatar === 'string' && ctx.user_avatar.trim() ? ctx.user_avatar.trim() : (named.length === 1 ? named[0] : '');
        const url = file ? `/User%20Avatars/${encodeURIComponent(file)}` : null;
        return url && isSafePortraitUrl(url) ? url : null;
    } catch { return null; }
}
