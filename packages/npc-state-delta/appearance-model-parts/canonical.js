/* The canonical appearance model, with the one-time conversion of version-1 forms. A part of appearance-model.js (same owner, moved without change). */
import { normalizeAppearanceForms } from './forms.js';
import { castWords } from './shared-cast-words.js';
import { CAST_APPEARANCE_WIDE } from '../core-mechanics.js';
import { APPEARANCE_MODEL_VERSION, appearanceText, clean, combineAppearance, formKey, stripOverallPrefix, truthy } from '../appearance-text.js';
import { CONCEALED_MENTION, physicalPieces, physicalTraitKeys, presentationSegments, traitParts, withoutSharedPieces } from '../appearance-physical.js';

export function normalizeAppearanceModel(raw = {}, { locked = false } = {}) {
    const words = locked ? { overall: false, wide: false } : castWords(raw);
    const wideMax = words.wide ? CAST_APPEARANCE_WIDE : undefined;
    const appearance = locked ? clean(raw.appearance, 1800) : appearanceText(raw.appearance, wideMax);
    const overallAppearance = locked || words.overall
        ? clean(raw.overallAppearance ?? raw.overall_appearance, 1800)
        : appearanceText(raw.overallAppearance ?? raw.overall_appearance);
    let unclassifiedAppearance = locked
        ? clean(raw.unclassifiedAppearance ?? raw.unclassified_appearance, 1800)
        : appearanceText(raw.unclassifiedAppearance ?? raw.unclassified_appearance);
    const rawForms = raw.appearanceForms ?? raw.appearance_forms;
    let appearanceForms = normalizeAppearanceForms(rawForms);
    if (appearanceForms.length && overallAppearance && !(Number(raw.appearanceModelVersion) >= APPEARANCE_MODEL_VERSION)) {
        // A version-1 form showed the shared features combined with its own text; store exactly
        // what it showed. A form the user marked [full] (1.0.95-1.0.97) already stood alone.
        const standalone = new Set((Array.isArray(rawForms) ? rawForms : [])
            .filter(form => form && truthy(form.fullTransformation ?? form.full_transformation))
            .map(form => formKey(form.name ?? form.form ?? form.formName ?? form.form_name)));
        appearanceForms = appearanceForms.map(form => (standalone.has(formKey(form.name))
            ? form
            : { ...form, appearance: legacyFormPresentation(overallAppearance, form.appearance) }));
    }
    const currentForm = clean(raw.currentForm ?? raw.current_form, 120);
    let currentFormUnknown = truthy(raw.currentFormUnknown ?? raw.current_form_unknown);
    if (currentForm) currentFormUnknown = false;
    const convertingV1 = appearanceForms.length && overallAppearance && !(Number(raw.appearanceModelVersion) >= APPEARANCE_MODEL_VERSION);
    if (currentFormUnknown && !unclassifiedAppearance) {
        unclassifiedAppearance = appearanceForms.length && !convertingV1 ? appearance : stripOverallPrefix(appearance, overallAppearance, wideMax);
    }
    // A version-1 unknown-form presentation showed the overall features in front of it; keep that.
    if (convertingV1 && currentFormUnknown && unclassifiedAppearance) {
        unclassifiedAppearance = combineAppearance(overallAppearance, unclassifiedAppearance);
    }
    return {
        appearance,
        overallAppearance,
        unclassifiedAppearance,
        appearanceForms,
        currentForm,
        currentFormUnknown,
        appearanceModelVersion: APPEARANCE_MODEL_VERSION,
    };
}

// Version-1 composition of a named form with the shared physical features, kept only to convert
// version-1 records: a form piece that only restated a shared trait was dropped, and a shared piece
// whose every trait the form described for itself gave way to the form's version.
function legacyFormPresentation(overall, value) {
    const own = appearanceText(value);
    if (!own) return own;
    const shared = appearanceText(overall);
    if (!shared) return own;
    const local = withoutSharedPieces(stripOverallPrefix(own, shared), shared);
    // Concealment applies to the whole piece ("silver hair and blue eyes are hidden …") before it
    // is split into traits.
    const addressed = new Set(presentationSegments(local)
        .filter(segment => !CONCEALED_MENTION.test(segment))
        .flatMap(traitParts)
        .flatMap(physicalPieces)
        .flatMap(physicalTraitKeys));
    const keepsTrait = part => {
        const keys = physicalTraitKeys(part);
        return !keys.length || !keys.every(key => addressed.has(key));
    };
    let dropped = false;
    const keptShared = presentationSegments(shared).flatMap(segment => {
        const parts = traitParts(segment);
        const kept = parts.filter(keepsTrait);
        if (kept.length === parts.length) return [segment];
        dropped = true;
        return kept.length ? [kept.join(' and ')] : [];
    });
    return combineAppearance(dropped ? keptShared.join(', ') : shared, local);
}
