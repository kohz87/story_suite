/* NPC State Delta injection: the always-present identity, agency, state and player-stance block of a card. */
import { cleanList } from '../core-text.js';
import { calibrateRelationshipSummary, DEFAULT_RELATIONSHIP, normalizeRelationshipBaseline, relationshipSummaryConsistent } from '../core-relationship.js';
import { KEY_RELATIONSHIP_LIMIT } from '../core-keyrel.js';
import { customFieldValues } from '../core-record.js';
import { orderedBehaviorProfile } from '../core-behavior.js';
import { buildBehaviorGuidance } from '../core-injection-selection.js';
import { fairInjectionParts, truncateInjectionText } from './truncate.js';

// Each lever keeps its category and as much of "level - effect" as its equal share allows, cut at a
// word boundary. (Cutting to the first three words left "high - refuses", which lost the meaning.)
function wordBoundedInjection(text, maxChars) {
    const value = String(text || '').trim().replace(/[\s.;]+$/, '');
    if (value.length <= maxChars) return value;
    const cut = value.slice(0, Math.max(1, maxChars - 1));
    const space = cut.lastIndexOf(' ');
    const head = (space >= Math.floor(maxChars * 0.6) ? cut.slice(0, space) : cut).replace(/[\s,;:\-–—]+$/, '');
    return `${head}…`;
}

function compactBehaviorProfileForInjection(value, maxChars = 180) {
    const entries = orderedBehaviorProfile(value);
    if (!entries.length) return '';
    const share = Math.floor((maxChars - 3 * (entries.length - 1)) / entries.length);
    // With little room every category still gets "Category: level" so none is starved; with room,
    // each lever keeps its effect as well.
    const levelOnly = share < 40;
    const compact = entries.map(item => {
        const match = item.match(/^([\p{L}][\p{L}\p{N} _\-/]{1,36})\s*:\s*(.*)$/u);
        if (!match) return wordBoundedInjection(item, Math.max(28, share));
        const label = match[1].split('/')[0].trim();
        const body = match[2].trim();
        if (levelOnly) {
            const level = body.split(/\s+[-–—]\s+|[.;,]/, 1)[0].trim().split(/\s+/).slice(0, 3).join(' ');
            return level ? `${label}: ${level}` : label;
        }
        return wordBoundedInjection(`${label}: ${body}`, share);
    });
    return truncateInjectionText(compact.join(' | '), maxChars);
}

function injectionIdentityCore(npc, identityCap = 540) {
    const others = [
        npc.personality && `personality: ${npc.personality}`,
        npc.speech && `speech: ${npc.speech}`,
        npc.mannerisms?.length && `mannerisms: ${npc.mannerisms.join(', ')}`,
    ].filter(Boolean);
    // Size the levers to the room the fair split below will actually give them: other identity
    // fields take at most an equal share and the levers get the rest (never more than 300 chars).
    const fairShare = Math.floor(identityCap / (others.length + 1));
    const leverRoom = identityCap - others.reduce((sum, part) => sum + Math.min(part.length, fairShare) + 2, 0) - 'behavioral profile: '.length;
    const leverCap = Math.min(1100, Math.max(fairShare - 'behavioral profile: '.length, leverRoom));
    const parts = [
        others[0] && others[0].startsWith('personality:') ? others[0] : '',
        npc.behaviorProfile?.length && `behavioral profile: ${compactBehaviorProfileForInjection(npc.behaviorProfile, leverCap)}`,
        ...others.filter(part => !part.startsWith('personality:')),
    ].filter(Boolean);
    return fairInjectionParts(parts, identityCap) || 'not yet established; do not invent an archetype to fill the gap';
}

function injectionAgencyCore(npc, agencyCap = 260, customFieldNames = []) {
    const bonds = cleanList(npc.keyRelationships, agencyCap >= 450 ? KEY_RELATIONSHIP_LIMIT : Math.min(3, KEY_RELATIONSHIP_LIMIT), 150);
    const custom = Object.entries(customFieldValues(npc, customFieldNames)).map(([name, value]) => `${name}: ${value}`).join(' · ');
    const parts = [
        custom && `established details: ${custom}`,
        npc.role && `role: ${npc.role}`,
        npc.goal && `goal: ${npc.goal}`,
        bonds.length && `bonds: ${bonds.join(' | ')}`,
    ].filter(Boolean);
    return fairInjectionParts(parts, agencyCap) || 'no additional agency facts established';
}

// A mood that names a stance toward the player ("devoted", "adoring") is a relationship claim, not
// a mood; below established trust/affection it is left out of the roleplay injection.
const STANCE_MOOD_WORDS = /\b(devoted|adoring|worshipful|worshipping|obedient|infatuated|lovestruck|besotted|smitten|enthralled)\b/i;

export function lowPlayerStanding(npc) {
    const rel = normalizeRelationshipBaseline(npc?.relationship || DEFAULT_RELATIONSHIP);
    return Math.max(rel.trust, rel.affection) < 50;
}

function injectedMood(npc) {
    const mood = String(npc?.mood || '').trim();
    if (!mood || !lowPlayerStanding(npc)) return mood;
    return mood.split(/\s*,\s*|\s*;\s*/).filter(part => part && !STANCE_MOOD_WORDS.test(part)).join(', ');
}

// While another extension owns the scene (Story Block's World State, Story Suite), the live mood
// and outfit come from it, so the cards leave them out and point there instead.
const SCENE_DEFERRED_STATE = 'live mood/outfit: as in World State';

function injectionCurrentStateCore(npc, stateCap = 180, sceneDeferred = false) {
    const mood = sceneDeferred ? '' : injectedMood(npc);
    const parts = [
        mood && `mood: ${mood}`,
        npc.status && `status: ${npc.status}`,
        sceneDeferred && SCENE_DEFERRED_STATE,
    ].filter(Boolean);
    return fairInjectionParts(parts, stateCap) || 'no overriding live emotional/condition state established';
}

function compactRelationshipModifier(npc, behaviorCap = 160) {
    const rel = normalizeRelationshipBaseline(npc?.relationship || DEFAULT_RELATIONSHIP);
    const summary = calibrateRelationshipSummary(npc?.relationshipSummary, rel);
    if (summary && relationshipSummaryConsistent(summary, rel)) return truncateInjectionText(summary, behaviorCap);
    return truncateInjectionText(buildBehaviorGuidance(npc), behaviorCap);
}

export function injectionEssentialBlock(npc, behaviorCap = 160, identityCap = 620, agencyCap = 300, stateCap = 180, customFieldNames = [], sceneDeferred = false) {
    const identity = injectionIdentityCore(npc, identityCap);
    const agency = injectionAgencyCore(npc, agencyCap, customFieldNames);
    const currentState = injectionCurrentStateCore(npc, stateCap, sceneDeferred);
    const relationship = compactRelationshipModifier(npc, behaviorCap);
    return `- ${npc.name}: IDENTITY: ${identity}; AGENCY/BONDS: ${agency}; STATE: ${currentState}; TOWARD PLAYER (secondary): ${relationship}`;
}
