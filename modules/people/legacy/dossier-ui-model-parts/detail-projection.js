/* NPC State Delta dossier surface: the full detail projection of one dossier record. */
import { currentPresentationText, normalizeAppearanceModel, resolveNpcAppearance } from '../appearance.js';
import { withSplitLook } from '../appearance-fill.js';
import { PACK_BIRTHDAY_REASON, formatBirthDate } from '../birthday.js';
import { normalizeMemoryStamps } from '../core-record-shared.js';
import { plain, relationshipValue, stringList, wholeNumber } from './values.js';
import { RELATIONSHIP_AXES, fieldChangesProjection, relationshipChangeProjection } from './change-projections.js';
import { displayedPortrait, portraitAppearanceChanged } from './portrait-source.js';
import { dossierIndexProjection } from './index-projection.js';

// (cleanup step 7) With `customFieldNames` (the configured names), only those custom fields are shown,
// as the injection and the suite profile show them; without it, every stored one (older callers).
function shownCustomFields(npc, customFieldNames) {
    const stored = Object.entries(npc?.customFields && typeof npc.customFields === 'object' ? npc.customFields : {});
    const configured = Array.isArray(customFieldNames) ? customFieldNames.map(name => plain(name).toLowerCase()).filter(Boolean) : null;
    return stored
        .filter(([name]) => !configured || configured.includes(plain(name).toLowerCase()))
        .map(([name, value]) => [plain(name), plain(value)]).filter(([name, value]) => name && value).slice(0, 12);
}

export function dossierDetailProjection(stored = {}, portraitAssets = {}, formPortraits = {}, { customFieldNames } = {}) {
    const npc = withSplitLook(stored);   // display only: a body written into the clothes field shows as Look; stored data waits for a write
    const rel = npc?.relationship && typeof npc.relationship === 'object' ? npc.relationship : {};
    const shown = displayedPortrait(npc, portraitAssets, formPortraits);
    return {
        ...dossierIndexProjection(npc, portraitAssets),
        portrait: shown.src,
        portraitFromForm: shown.fromForm,
        formPortraits: Object.fromEntries(Object.entries(formPortraits || {}).filter(([, image]) => image?.dataUrl).map(([name, image]) => [name, plain(image.dataUrl)])),
        age: plain(npc?.age),
        appearance: resolveNpcAppearance(npc),
        appearanceModel: normalizeAppearanceModel(npc, { locked: Array.isArray(npc?.manualProfileFields) && npc.manualProfileFields.includes('appearance') }),
        currentPresentation: currentPresentationText(npc),
        birthday: formatBirthDate(npc?.birthDate),
        birthdaySource: npc?.birthDateReason === PACK_BIRTHDAY_REASON ? '' : plain(npc?.birthDateSource),   // a pack date is not "story established"
        personality: plain(npc?.personality),
        behaviorProfile: stringList(npc?.behaviorProfile, 10),
        speech: plain(npc?.speech),
        mannerisms: stringList(npc?.mannerisms, 10),
        background: plain(npc?.background),
        memories: stringList(npc?.memories, 8),
        memoryStamps: normalizeMemoryStamps(npc?.memoryStamps, npc?.memories) ?? {},
        keyRelationships: stringList(npc?.keyRelationships, 12),
        customFields: shownCustomFields(npc, customFieldNames),
        relationshipSummary: plain(npc?.relationshipSummary),
        lastRelationshipChange: relationshipChangeProjection(npc?.lastRelationshipChange),
        fieldChanges: fieldChangesProjection(npc?.fieldChanges, npc?.fieldChangeMessages),
        portraitAppearanceChanged: portraitAppearanceChanged(npc, shown),
        portraitForm: shown.form,
        recentRelationshipChanges: (Array.isArray(npc?.relationshipEventHistory) ? npc.relationshipEventHistory : [])
            .slice(-12)   // the card shows three, after it leaves out this reply's own event (dossier-ui-relationship.js)
            .reverse()
            .map(event => ({
                impact: plain(event?.impact, 'ordinary').toLocaleLowerCase(),
                reason: plain(event?.reason),
                turn: Number.isFinite(Number(event?.turn)) ? Number(event.turn) : null,
                message: wholeNumber(event?.message),
                // The axes the event had evidence for: the stored history keeps the tier, the evidence and the reason, no signed numbers.
                axes: RELATIONSHIP_AXES.filter(([axis]) => plain(event?.evidence?.[axis])).map(([, label]) => label),
            }))
            .filter(event => event.reason),
        relationship: {
            trust: relationshipValue(rel.trust),
            affection: relationshipValue(rel.affection),
            desire: relationshipValue(rel.desire),
            tension: relationshipValue(rel.tension),
        },
        mood: plain(npc?.mood),
        goal: plain(npc?.goal),
        lifeStateCertainty: plain(npc?.lifeStateCertainty),
        lifeStateReason: plain(npc?.lifeStateReason),
    };
}
