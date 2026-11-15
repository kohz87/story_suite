/* NPC State Delta dossier view-model part: bond tones in the board's vocabulary and the library face ring. */
import { plain, relationshipValue } from '../dossier-ui-model.js';
import { bondTone as bondToneOf } from '../dossier-ui-bond-tone.js';
import { object } from './shared-object.js';

// Bond tone of a relation word in the board's vocabulary (good / bad / gold / grey), from dossier-ui-bond-tone.js.
const BOARD_TONE = { close: 'good', hostile: 'bad', duty: 'gold', neutral: 'grey' };
export const boardTone = tone => BOARD_TONE[tone] || 'grey';
export function bondTone(relation) {
    return boardTone(bondToneOf(plain(relation)));
}

// The library face ring from how the person stands with the player: 'ally' (green), 'rival' (red) or '' (plain).
// The gold "owed" ring has no data behind it yet, so it is not drawn.
export function libraryTone(relationship) {
    const rel = object(relationship);
    const trust = relationshipValue(rel.trust);
    const affection = relationshipValue(rel.affection);
    const tension = relationshipValue(rel.tension);
    if (trust <= -20 || (tension >= 50 && trust < 20)) return 'rival';
    if (trust >= 20 || affection >= 20) return 'ally';
    return '';
}
