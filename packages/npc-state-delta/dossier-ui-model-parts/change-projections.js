/* NPC State Delta dossier surface: the relationship axes and the change projections the detail view shows. */
import { changeStamp } from './change-stamps.js';
import { plain, wholeNumber } from './values.js';

const RELATIONSHIP_AXES = Object.freeze([['trust', 'Trust'], ['affection', 'Affection'], ['desire', 'Desire'], ['tension', 'Tension']]);

function relationshipChangeProjection(change = {}) {
    const source = change && typeof change === 'object' ? change : {};
    const delta = source.delta && typeof source.delta === 'object' ? source.delta : {};
    const turn = Number.isFinite(Number(source.turn)) ? Number(source.turn) : null;
    const message = wholeNumber(source.message);
    return {
        impact: plain(source.impact, 'none').toLocaleLowerCase(),
        delta: Object.fromEntries(RELATIONSHIP_AXES.map(([axis]) => [axis, Math.round(Number(delta[axis]) || 0)])),
        reason: plain(source.reason),
        turn,
        message,
        when: changeStamp({ turn, message }).label,
    };
}

const FIELD_CHANGE_LABELS = Object.freeze({
    mood: 'Mood', location: 'Location', goal: 'Goal', status: 'Condition', homeBase: 'Home Base', age: 'Age',
    apparentAge: 'Apparent age', lifeState: 'Life state', personality: 'Personality', speech: 'Speech',
    behaviorProfile: 'Behavioral Levers', mannerisms: 'Mannerisms', appearance: 'Appearance', relationship: 'Relationship',
    relationshipSummary: 'Player Dynamic', background: 'Background', keyRelationships: 'Bonds', memories: 'Memories', birthDate: 'Birthday',
});

// Latest is still decided by Delta's turn counter; the reply number shows only when every field of
// that latest change carries the same one (a change from before 1.2.3 has none).
function fieldChangesProjection(value, messageValue) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const messages = messageValue && typeof messageValue === 'object' && !Array.isArray(messageValue) ? messageValue : {};
    const turns = Object.fromEntries(Object.keys(FIELD_CHANGE_LABELS)
        .map(field => [field, Number(source[field])])
        .filter(([, turn]) => Number.isInteger(turn) && turn >= 0));
    const latestTurn = Object.values(turns).reduce((max, turn) => Math.max(max, turn), -1);
    const latest = latestTurn >= 0 ? Object.keys(turns).filter(field => turns[field] === latestTurn) : [];
    const latestMessages = [...new Set(latest.map(field => wholeNumber(messages[field])))];
    return {
        latestTurn: latestTurn >= 0 ? latestTurn : null,
        latest,
        message: latestMessages.length === 1 ? latestMessages[0] : null,
    };
}

export { RELATIONSHIP_AXES, FIELD_CHANGE_LABELS, relationshipChangeProjection, fieldChangesProjection };
