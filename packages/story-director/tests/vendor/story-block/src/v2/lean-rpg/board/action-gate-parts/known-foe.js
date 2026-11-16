// Decides whether a message explicitly attacks a standing, already known foe.
import { findAttacks } from './phrasal.js';
import { READER_SUBJECT, ownSubjectOk } from './reader-subject.js';

const OFFENSIVE_SKILL = /\b(?:attack|strik\w*|cut|slash\w*|stab\w*|damage|wound\w*|hit|shoot\w*|blast\w*|ambush\w*|weapon|blade|sword|combat)\b/iu;
const UNCERTAIN = /\b(?:not|never|no|avoid|avoidance|instead|if|unless|whether|would|could|might|maybe|consider|discuss|ask|tell|say|says|said|warn|threaten|talk|speak|don't|dont|won't|wont|cannot|can't|cant)\b/iu;

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const parts = text => String(text ?? '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

function foeTarget(phrase, foes) {
    const tokens = parts(phrase);
    const target = ['them', 'it', 'enemy', 'enemies', 'foe', 'foes', 'opponent', 'opponents'];
    for (const foe of foes) for (const part of parts(foe.name)) if (part.length >= 3) target.push(part);
    const matches = word => target.some(part => word === part || `${word}s` === part || `${part}s` === word);
    const namesAt = start => {
        let at = start;
        while (['a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'all'].includes(tokens[at])) at += 1;
        return matches(tokens[at]);
    };
    if (namesAt(0)) return true;
    // A weapon may precede an explicit target: "swing my sword at the rats".
    return tokens.some((word, at) => ['at', 'against', 'toward', 'towards', 'on', 'upon', 'into', 'for'].includes(word) && namesAt(at + 1));
}

export function knownFoeAction(text, sheet) {
    const foes = (sheet?.foes ?? []).filter(foe => foe.filled && foe.hurt > 0);
    if (!foes.length) return false;
    const skills = (sheet?.characters ?? []).flatMap(actor => actor.skills ?? []).filter(skill => OFFENSIVE_SKILL.test(`${skill.name ?? ''} ${skill.about ?? ''}`));
    const clauses = String(text ?? '').replace(/[“"][^”"]*[”"]/gu, ' ').split(/[.!?;\n]|\b(?:and|then|but)\b/iu);
    return clauses.some(clause => {
        if (UNCERTAIN.test(clause)) return false;
        let actions = [];
        for (const skill of skills) {
            const name = String(skill.name ?? '').trim();
            if (name.length < 3) continue;
            const match = new RegExp(`\\b(?:use|using|cast|perform)\\s+(?:my\\s+)?${escape(name)}\\s+(?:on|at|against)\\b`, 'iu').exec(clause);
            if (match) { actions = [match]; break; }
        }
        if (!actions.length) actions = findAttacks(clause);
        // Every attack word is judged: "while the dogs are mauling him, I attack the dogs" is the reader attacking.
        return actions.some(action => {
            const before = clause.slice(0, action.index).trim();
            if (before && !READER_SUBJECT.test(before)) return false;
            if (before && !ownSubjectOk(before, clause, action)) return false;
            return foeTarget(clause.slice(action.index + (action.length ?? action[0].length)), foes);
        });
    });
}
