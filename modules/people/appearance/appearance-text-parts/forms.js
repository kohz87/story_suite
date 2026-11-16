/* Named-form limits (form count, model version) and form key/state normalisation. A part of appearance-text.js (same owner, moved without change). */
import { clean } from './basics.js';

export const APPEARANCE_FORM_LIMIT = 8;
// Version 2: a named form's description is that form's complete appearance. Version 1 forms were
// partial and were combined with the shared physical features when resolved; normalization
// converts them once (see legacyFormPresentation).
export const APPEARANCE_MODEL_VERSION = 2;
export function formKey(value) { return clean(value, 120).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
export function formState(value) {
    const state = String(value ?? '').trim().toLowerCase();
    if (['change', 'evolve', 'correct'].includes(state)) return 'change';
    if (['refine', 'update', 'learn', 'establish'].includes(state)) return 'refine';
    return 'keep';
}
