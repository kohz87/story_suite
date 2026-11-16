/* Resolving the appearance an NPC shows now and its editable current presentation. A part of appearance-model.js (same owner, moved without change). */
import { appearanceFormByName } from './forms.js';
import { castWords } from './shared-cast-words.js';
import { normalizeAppearanceModel } from './canonical.js';
import { CAST_APPEARANCE_WIDE } from '../../core/core-mechanics.js';
import { appearanceText, combineAppearance, stripOverallPrefix } from '../appearance-text.js';

export function resolveNpcAppearance(rawNpc = {}) {
    const model = normalizeAppearanceModel(rawNpc, {
        locked: Array.isArray(rawNpc?.manualProfileFields) && rawNpc.manualProfileFields.includes('appearance'),
    });
    const current = model.currentForm ? appearanceFormByName(model, model.currentForm) : null;
    const overall = model.overallAppearance;
    if (current) return appearanceText(current.appearance);
    // An unknown transformed form of an NPC with named forms is described completely too; the
    // overall slot serves only an NPC without forms.
    if (model.currentFormUnknown && model.appearanceForms.length) return appearanceText(model.unclassifiedAppearance || model.appearance);
    const words = castWords(rawNpc);
    const wideMax = words.wide ? CAST_APPEARANCE_WIDE : undefined;
    // The stored text of a cast dossier still is "<pack's look>; <pack's wears>": it is already the resolved appearance, kept as it is
    // (resolving it again would strip the look from it and join the outfit's sentences with "; " a second time).
    if (words.resolved && !model.currentFormUnknown && !model.currentForm && model.appearance) return model.appearance;
    if (model.currentFormUnknown) return combineAppearance(overall, model.unclassifiedAppearance || model.appearance);
    if (model.currentForm) return combineAppearance(overall, model.unclassifiedAppearance || model.appearance);
    // Without a selected form, enduring physical features (the shared slot) plus the current
    // outfit/presentation make up what is visible now.
    if (model.appearance || overall) return combineAppearance(overall, model.appearance, wideMax);
    return appearanceFormByName(model, 'Base')?.appearance || model.appearanceForms[0]?.appearance || '';
}

// The editable current outfit/presentation for an NPC without a selected form: the stored current
// appearance without the enduring physical features already held in the shared slot.
export function currentPresentationText(rawNpc = {}) {
    const model = normalizeAppearanceModel(rawNpc, {
        locked: Array.isArray(rawNpc?.manualProfileFields) && rawNpc.manualProfileFields.includes('appearance'),
    });
    if (model.currentForm || model.currentFormUnknown) return '';
    return stripOverallPrefix(model.appearance, model.overallAppearance, castWords(rawNpc).wide ? CAST_APPEARANCE_WIDE : undefined);
}
