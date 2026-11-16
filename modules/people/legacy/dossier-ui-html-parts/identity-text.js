/* NPC State Delta dossier surface: the capitalised identity line and the one-age text. */
import { plain } from '../dossier-ui-model.js';

// As written in the dossier, with the first letter of each part capitalised.
export const capFirst = value => { const text = plain(value); return text ? `${[...text][0].toUpperCase()}${[...text].slice(1).join('')}` : ''; };

// ONE age: the real age when known, else "~N" from the apparent age (never a separate "Looks"); '' when neither is known.
function ageText(npc) {
    const real = plain(npc?.age);
    if (real) return real;
    const apparent = plain(npc?.apparentAge).replace(/^~\s*/, '');
    return apparent ? `~${apparent}` : '';
}

function identityLine(npc) {
    return [
        capFirst(npc?.species),
        capFirst(npc?.gender),
        capFirst(npc?.role),
        ageText(npc) ? `Age ${ageText(npc)}` : '',
    ].filter(Boolean).join(' · ') || 'Identity details not established';
}

export { ageText, identityLine };
