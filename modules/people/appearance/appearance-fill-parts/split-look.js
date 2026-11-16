/* Splitting a look written into the clothes field: body clauses move to overallAppearance. A part of appearance-fill.js (same owner, moved without change). */
import { eligible, patternOf } from './shared-basics.js';
import { DURABLE_PROFILE_LIMITS } from '../../core/core-mechanics.js';
import { appearanceClauses, appearanceText, combineAppearance } from '../appearance-text.js';
import { currentPresentationText } from '../appearance-model.js';
import { CHANGEABLE_PRESENTATION, PHYSICAL_TRAITS, physicalTraitKeys } from '../appearance-physical.js';

// The split of a look written into the clothes field (the scanner, the capture or a fill put build, height, hair ... in `appearance` and left
// overallAppearance blank or short). Pure and deterministic; the owner's words move whole, nothing is added or reworded.
// A comma piece is BODY when it names a physical trait (PHYSICAL_TRAITS keys) and no clothing/condition word; CLOTHES when it names clothing, gear or
// condition; any other piece follows the piece before it (a leading one stays with the clothes). A piece whose traits the overall text already
// describes stays where it is (no repeat). Named forms, a manually fixed appearance and pack-cast first words are never split.
const splittable = npc => eligible(npc) && !npc.castFrom?.first;
const limit = () => DURABLE_PROFILE_LIMITS?.appearance || 800;
const pieceClass = piece => (CHANGEABLE_PRESENTATION.test(piece) ? 'clothes' : physicalTraitKeys(piece).length ? 'body' : null);

// What a Look already says counts per trait, with wider words for height and for the parts of the figure (bust ...): the owner's Look "very petite
// build no taller than a boy of twelve ... heavy, round bust" already states height and bust, so the same words in Wearing are duplicates.
const HEIGHT_SAID = /\b(?:tall|taller|tallest|height|towering|diminutive|statuesque|petite|short|shorter|tiny|(?:\d+|one|two|three|four|five|six|seven|eight)\s+(?:feet|foot|ft))\b/i;
const PARTS = /\b(?:breasts?|bust|bosom|chest|hips?|waist|thighs?)\b/i;
const PART_TAIL = /\s+(?:straining|stretched|stretching|pulled|clinging|tight|resting|pressed|spilling)?\s*(?:across|over|against|around)\s+[^;.]*?\b(?:breasts?|bust|bosom|chest|hips?|waist|thighs?)\b[^;.]*$/i;
const said = (key, text) => (key === 'height' ? HEIGHT_SAID : patternOf(key)).test(text);
const lowerLead = text => text.replace(/^(?:Her|His|Their|Its|She|He|They|The|A|An)\b/, word => word.toLowerCase());

/** { overall, appearance, moved } for a record: the body clauses of its clothes text moved into overallAppearance. `moved` is false (and the
 *  texts the stored ones) when nothing moves or drops. A body piece whose trait the overall text already states is dropped from the clothes
 *  (never shown twice); one it lacks moves. Stored data is not touched; callers use the result for display and on a write. */
export function splitLook(npc = {}) {
    const same = { overall: appearanceText(npc?.overallAppearance), appearance: appearanceText(npc?.appearance), moved: false };
    if (!splittable(npc)) return same;
    const overall = same.overall;
    const source = overall ? appearanceText(currentPresentationText(npc)) : same.appearance;
    const have = new Set(overall ? [...PHYSICAL_TRAITS.map(([key]) => key), 'height'].filter(key => said(key, overall)) : []);
    const body = [];
    const clothes = [];
    let dropped = false;
    for (let clause of appearanceClauses(source)) {
        clause = clause.replace(/[.!?]+$/, '');
        if (overall && PARTS.test(overall) && PART_TAIL.test(clause)) { clause = clause.replace(PART_TAIL, ''); dropped = true; }
        const pieces = clause.split(/\s*,\s*/).filter(Boolean);
        const kinds = pieces.map(piece => {
            const found = pieceClass(piece);
            return found === 'body' && physicalTraitKeys(piece).every(key => have.has(key)) ? 'dup' : found;
        });
        // A piece naming nothing follows the piece before it; leading ones go with the first body piece when that is what comes next.
        const firstFound = kinds.find(Boolean);
        let last = firstFound === 'body' ? 'body' : 'clothes';
        const mine = { body: [], clothes: [] };
        pieces.forEach((piece, index) => {
            last = kinds[index] || last;
            if (last === 'dup') dropped = true; else mine[last].push(piece);
        });
        if (mine.body.length) body.push(lowerLead(mine.body.join(', ')));
        if (mine.clothes.length) clothes.push(mine.clothes.join(', '));
    }
    if (!body.length && !dropped) return same;
    const tail = /[.!?]\s*$/.test(source) ? '.' : '';
    const wearing = clothes.length ? clothes.join('; ') + tail : '';
    const joined = body.join('; ') + (clothes.length ? '' : tail);
    const moved = body.length ? (overall ? `${overall.replace(/[\s.;,]+$/, '')}; ${joined}` : joined) : overall;
    if (moved.length > limit()) return same;
    return { overall: moved, appearance: combineAppearance(moved, wearing), moved: true };
}

/** The record with its look split (a copy), or the record itself when nothing moves. */
export function withSplitLook(npc) {
    const split = npc && typeof npc === 'object' ? splitLook(npc) : null;
    return split?.moved ? { ...npc, overallAppearance: split.overall, appearance: split.appearance } : npc;
}
