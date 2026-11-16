// Scanner, backfill, dossier-import and profile-refresh prompts with the birthday and custom-field rules applied.
import * as continuity from '../continuity-core.js';
import * as mechanics from '../core-mechanics.js';
import { calendarPromptOptions, appendBirthdayRule, withCaptureBirthdayRule, insertRefreshBirthdayRule } from './shared-birthday-rules.js';
import { appendCustomFieldRule } from './shared-custom-field-rule.js';

export function buildScannerPrompt(options = {}) {
    const prompt = continuity.buildScannerPrompt(calendarPromptOptions(options));
    if (options.narrationCapture) return appendCustomFieldRule(withCaptureBirthdayRule(prompt, options), options);
    return appendCustomFieldRule(appendBirthdayRule(prompt, options), options);
}

export function buildBackfillPrompt(options = {}) {
    return mechanics.appendHiddenNotePrompt(appendCustomFieldRule(appendBirthdayRule(continuity.buildBackfillPrompt(calendarPromptOptions(options)), options), options), options);
}
export function buildDossierImportPrompt(options = {}) {
    return appendCustomFieldRule(appendBirthdayRule(continuity.buildDossierImportPrompt(calendarPromptOptions(options)), options), { ...options, customFieldSource: 'the dossier text' });
}
export function buildProfileRefreshPrompt(options = {}) {
    return mechanics.appendHiddenNotePrompt(appendCustomFieldRule(insertRefreshBirthdayRule(continuity.buildProfileRefreshPrompt(calendarPromptOptions(options)), options), options), options);
}
