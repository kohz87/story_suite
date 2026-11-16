/* NPC State Delta behavior guidance: turns a person's relationship scores into a short behavior cue line. */
import { DEFAULT_RELATIONSHIP, normalizeRelationshipBaseline, RELATIONSHIP_KEYS } from '../core-relationship.js';

export function buildBehaviorGuidance(npc) {
    const rel = normalizeRelationshipBaseline(npc?.relationship || DEFAULT_RELATIONSHIP);
    const material = RELATIONSHIP_KEYS
        .map(key => ({ key, value: rel[key], magnitude: Math.abs(rel[key]) }))
        .filter(item => item.magnitude >= 30)
        .sort((a, b) => b.magnitude - a.magnitude || RELATIONSHIP_KEYS.indexOf(a.key) - RELATIONSHIP_KEYS.indexOf(b.key));
    if (!material.length) return 'relationship remains mostly neutral or unsettled; let identity, goals, and current state drive behavior';

    const cues = [];
    for (const { key, value } of material) {
        if (key === 'trust') {
            if (value <= -70) cues.push('strong distrust: protect self and verify claims');
            else if (value <= -30) cues.push('distrust: remain guarded about reliance');
            else if (value < 70) cues.push('trust: some extra candor/reliance is plausible');
            else cues.push('strong trust: vulnerability/reliance is permitted when identity and context allow');
        } else if (key === 'affection') {
            if (value <= -70) cues.push('strong resentment/dislike may cool treatment');
            else if (value <= -30) cues.push('dislike/resentment is established');
            else if (value < 70) cues.push('affection: modest extra concern/attention may appear through established care style');
            else cues.push('strong affection: high emotional importance, not devotion or self-erasure');
        } else if (key === 'desire') {
            if (value <= -70) cues.push('strong aversion to intimate/romantic closeness');
            else if (value <= -30) cues.push('aversion to intimate/romantic closeness is established');
            else if (value < 70) cues.push('attraction may subtly color attention only when context supports it');
            else cues.push('strong desire may affect attention/proximity only through established expressiveness and consent');
        } else if (key === 'tension') {
            if (value <= -70) cues.push('exceptional ease/safety may lower interpersonal pressure');
            else if (value <= -30) cues.push('noticeable ease/reduced pressure is established');
            else if (value < 70) cues.push('unresolved pressure may affect delivery only in the form the scene supports');
            else cues.push('strong unresolved pressure matters, but does not imply jealousy, embarrassment, hostility, or denial');
        }
    }
    const combinations = [];
    if (rel.trust >= 70 && rel.tension >= 70) combinations.push('familiarity and strain coexist');
    if (rel.affection >= 70 && rel.trust <= -30) combinations.push('care does not erase distrust');
    if (rel.desire >= 70 && rel.trust <= -30) combinations.push('attraction does not imply safety or trust');
    return [...combinations, ...cues].join('; ');
}
