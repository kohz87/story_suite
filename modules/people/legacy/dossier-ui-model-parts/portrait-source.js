/* NPC State Delta dossier surface: which portrait a dossier shows and whether its appearance has changed since. */
import { appearanceFingerprint } from '../appearance.js';
import { portraitSrc } from '../src/portrait-file.js';
import { plain } from './values.js';

function portraitAppearanceChanged(npc = {}, shown = null) {
    const recorded = shown ? shown.fingerprint : plain(npc?.portrait?.appearanceFingerprint);
    const src = shown ? shown.src : plain(portraitSrc(npc?.portrait));
    if (!recorded || !src) return false;
    const current = appearanceFingerprint(npc, { version: recorded.startsWith('a1:') ? 1 : 2 });
    return Boolean(current) && current !== recorded;
}

function portraitSource(npc = {}, portraitAssets = {}) {
    const direct = npc?.portrait && typeof npc.portrait === 'object' ? npc.portrait : {};
    const asset = portraitAssets?.[npc?.id] && typeof portraitAssets[npc.id] === 'object' ? portraitAssets[npc.id] : {};
    return plain(portraitSrc(direct) || portraitSrc(asset));
}

// The displayed portrait follows the current appearance form when that form has its own image;
// otherwise it is the main portrait. Form images are read-only view data here.
function displayedPortrait(npc = {}, portraitAssets = {}, formPortraits = {}) {
    const form = plain(npc?.currentForm);
    const formImage = form ? Object.entries(formPortraits || {}).find(([name]) => name.toLocaleLowerCase() === form.toLocaleLowerCase())?.[1] : null;
    if (formImage?.dataUrl) return { src: plain(formImage.dataUrl), fingerprint: plain(formImage.appearanceFingerprint), form, fromForm: true };
    return { src: portraitSource(npc, portraitAssets), fingerprint: plain(npc?.portrait?.appearanceFingerprint), form: plain(npc?.portrait?.appearanceForm), fromForm: false };
}

export { portraitAppearanceChanged, portraitSource, displayedPortrait };
