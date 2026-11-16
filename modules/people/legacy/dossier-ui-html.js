/* NPC State Delta dossier surface: escaped dossier markup, cards, forms and portrait references. Public face: re-exports its parts. */
export { listHtml, proseHtml } from './dossier-ui-html-parts/prose.js';
export { createPortraitRefs, portraitMark } from './dossier-ui-html-parts/portrait-refs.js';
export { initialsOf, portraitHtml } from './dossier-ui-html-parts/portrait-markup.js';
export { capFirst, ageText, identityLine } from './dossier-ui-html-parts/identity-text.js';
export { changedMark, changeSummaryHtml } from './dossier-ui-html-parts/change-marks.js';
export { currentCard, birthdayCard } from './dossier-ui-html-parts/cards.js';
export { appearanceFormsHtml } from './dossier-ui-html-parts/appearance-forms.js';
export { reconcileDocumentSections, countsFor, visibleElement } from './dossier-ui-html-parts/dom-helpers.js';
