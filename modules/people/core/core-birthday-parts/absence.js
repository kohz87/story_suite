/* NPC State Delta detecting from narration that an NPC is currently absent from the scene. */
import { npcOwnedSentences, foreignSubjectClause, npcFirstLabels } from './owned-text.js';

// Wording that places the NPC outside the current scene ("is not here", "remains at her distant home").
const ABSENCE_WORDING = /\b(?:not (?:here|present|there|in the room|with (?:us|them|him|her))|(?:isn|wasn|aren|weren)['’]?t (?:here|present|there|around)|absent|elsewhere|far away|off[- ]?screen|remains? (?:at|in) (?:her|his|their) (?:distant |own )?(?:home|house|room|quarters)|has (?:already )?left|is (?:away|gone))\b/i;

const HISTORICAL_ABSENCE = /\b(?:ago|earlier|before|previously|until|last\s+(?:night|week)|yesterday|had been)\b/i;
const CURRENT_PARTICIPATION = /\b(?:now|returns?|returned|arrives?|arrived|comes? (?:back|in)|steps? (?:in|inside|back)|enters?|entered|joins?|joined|sits? (?:beside|with|down)|greets?|here now)\b/i;
// A return/arrival that is denied ("does not return") or still ahead ("will return tomorrow") means
// the NPC is not here now; a hypothetical one ("might return if ...") says nothing.
const RETURN_VERBS = /\b(?:returns?|arrives?|arrive|comes? (?:back|in)|come (?:back|in)|steps? (?:in|inside|back))\b/i;
const NEGATED_WORDING = /\b(?:not|never|no longer)\b|n['’]t\b/i;
const FUTURE_WORDING = /\b(?:will|tomorrow|later|soon|going to|plans? to|intends? to)\b/i;
const HYPOTHETICAL_WORDING = /\b(?:if|unless|might|may|would|could)\b/i;
const CLAUSE_BOUNDARY = /,|;|\s+(?:but|then|and then|because|while|although|though)\s+/i;

// The NPC's latest current state in the text: another person's absence ("because Noela is not
// here") and an absence the narration then resolves ("was not here an hour ago, but now steps
// inside") do not make this NPC absent.
export function npcCurrentlyAbsentInText(npc, text) {
    const own = npcFirstLabels(npc);
    let absent = false;
    for (const sentence of npcOwnedSentences(npc, text)) {
        for (const clause of sentence.split(CLAUSE_BOUNDARY).map(part => String(part || '').trim()).filter(Boolean)) {
            if (foreignSubjectClause(clause, own)) continue;
            if (ABSENCE_WORDING.test(clause) && !HISTORICAL_ABSENCE.test(clause)) absent = true;
            else if (RETURN_VERBS.test(clause) && (NEGATED_WORDING.test(clause) || FUTURE_WORDING.test(clause))) absent = true;
            else if (CURRENT_PARTICIPATION.test(clause) && !HYPOTHETICAL_WORDING.test(clause) && !NEGATED_WORDING.test(clause)) absent = false;
        }
    }
    return absent;
}
