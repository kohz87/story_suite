/* NPC State Delta custom-field parsing, value projection and grounded merge. Split from core-record.js without change;
   core-record.js re-exports every name it exported before. Public face: re-exports its parts. */
export { CUSTOM_FIELD_LIMIT, normalizeCustomFieldNames, normalizeCustomFields, customFieldValues } from './core-record-custom-fields-parts/names.js';
export { mergeCustomFieldValues } from './core-record-custom-fields-parts/merge.js';
export { sheetLevelOf, applySheetLevels, withoutSheetLevels } from './core-record-custom-fields-parts/sheet-levels.js';
