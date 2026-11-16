// The loose attack-word gate: whether a typed message could be an attack at all.
import { findAttack } from '../action-gate.js';

const UNCERTAIN = /\b(?:not|never|no|avoid|avoidance|instead|if|unless|whether|would|could|might|maybe|consider|discuss|ask|tell|say|says|said|warn|threaten|talk|speak|don't|dont|won't|wont|cannot|can't|cant)\b/iu;
/**
* Whether the message could be an attack: any clause (also a comma or colon part, so a doubt word only cancels its own part) with an attack word or phrasal attack and no doubt word. The gate is LOOSE on purpose
 * (no subject test: a third party or an idiom passes); the Assist reading decides whether the reader is really starting a fight.
 */
export function looksLikeAttack(message) {
    const text = String(message ?? '').replace(/[“"][^”"]*[”"]/gu, ' ');
    return text.split(/[.!?;:,\n]|\b(?:and|then|but)\b/iu).some(clause => !UNCERTAIN.test(clause) && findAttack(clause) !== null);
}
