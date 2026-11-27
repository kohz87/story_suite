// Story Director v2, part **cast**: a world person's public face for the narrator (name, role, look, manner, voice).
//
// The one builder the "People here" line (here.js) and the rumor line (rumor-line.js) share, so both tell the same public face and never a secret,
// a history or anything gated. Pure: read from the pack entry.

import { cutWords } from '../domain.js';

const ROLE_MAX = 60;
const LOOK_MAX = 90;
const MANNER_MAX = 70;
const VOICE_MAX = 90;

/** `Name, role (species. look), manner: first sentence of the personality, speaks: voice` for a cast entry (a "; " inside a part reads as a comma). */
export function faceOf(entry) {
    const role = cutWords(String(entry.raw?.role ?? '').replace(/;/g, ','), ROLE_MAX);
    const species = String(entry.raw?.species ?? '').trim().replace(/;/g, ',');
    // (the race leads the look when the look doesn't name it, so the narrator never guesses it)
    const look = cutWords(`${species && !String(entry.raw?.look ?? '').toLowerCase().includes(species.toLowerCase()) ? `${species}. ` : ''}${String(entry.raw?.look ?? '')}`.replace(/;/g, ','), LOOK_MAX);
    // (the first sentence of the personality, and the voice, so the first lines they speak are theirs)
    const manner = cutWords(String(entry.raw?.personality ?? '').split(/(?<=[.!?])\s/)[0].replace(/;/g, ',').replace(/[.]$/, ''), MANNER_MAX);
    const voice = cutWords(String(entry.raw?.voice ?? '').replace(/;/g, ',').replace(/[.]$/, ''), VOICE_MAX);
    return `${entry.name}${role ? `, ${role}` : ''}${look ? ` (${look.replace(/[.]$/, '')})` : ''}${manner ? `, manner: ${manner}` : ''}${voice ? `, speaks: ${voice}` : ''}`;
}
