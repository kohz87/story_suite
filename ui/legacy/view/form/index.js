// The form engine (UI stage 1b, PR B): field renderers and the function that renders a module's settings from its schema.
// Public face: re-exports its parts.
export { FIELD_KINDS, FORM_TEXT, changeNote, fieldKind } from './index-parts/schema-names.js';
export { labelOf, matchesSearch, optionsOf } from './index-parts/schema-lookups.js';
export { RENDERERS, chipsField, chipsetField, linesField } from './index-parts/renderers-core.js';
export { newId, numberField, profileField, searchField } from './index-parts/renderers-inputs.js';
export { sectionBlock, segmentedField, selectField, sliderField } from './index-parts/renderers-blocks.js';
export { switchField, textField } from './index-parts/renderers-text.js';
export { featureGroups, renderFeaturesForm, renderModuleForm, renderSettingsForm } from './index-parts/forms.js';
