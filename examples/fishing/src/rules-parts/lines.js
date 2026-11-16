// The sentences a cast tells: the item note and the landed, lost and released lines.
import { formatWeight, describeCatch, theCatch } from './tell.js';

/** The item note: "Caught at Moonfall Lake; 4.2 kg, fine." */
export function catchNote(c, spotName) {
    return `Caught at ${spotName}; ${formatWeight(c.grams)}, ${c.quality}.`;
}

/** "Astra lands a rare 4.2 kg silver-violet trout at Moonfall Lake." */
export function landedLine(who, c, spotName) {
    return `${who} ${landsVerb(who)} ${describeCatch(c)} at ${spotName}.`;
}

/** "Something takes the bait at Moonfall Lake and gets away from Astra." */
export function lostLine(who, spotName) {
    return `Something takes the bait at ${spotName} and gets away from ${who}.`;
}

/** "Astra lets the 4.2 kg silver-violet trout go back into Moonfall Lake." */
export function releasedLine(who, c, spotName) {
    return `${who} ${who === 'You' ? 'let' : 'lets'} ${theCatch(c)} go back into ${spotName}.`;
}

function landsVerb(who) {
    return who === 'You' ? 'land' : 'lands';
}
