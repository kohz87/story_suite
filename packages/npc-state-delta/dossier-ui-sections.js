/* NPC State Delta dossier surface: the six section screens (Mood, Right now, With {{user}}, Ties, Past, Secrets) and their header with arrows and dots. Escaped markup only; reads the existing dossier projection, no new data. Public face: re-exports its parts. */
export { SECTION_IDS, sectionTitle, sectionStep, sectionHeaderHtml } from './dossier-ui-sections-parts/section-header.js';
export { moodSectionHtml } from './dossier-ui-sections-parts/mood-section.js';
export { nowSectionHtml } from './dossier-ui-sections-parts/now-section.js';
export { withSectionHtml } from './dossier-ui-sections-parts/with-section.js';
export { tiesSectionHtml } from './dossier-ui-sections-parts/ties-section.js';
export { liesHtml, knowsHtml } from './dossier-ui-sections-parts/notes-blocks.js';
export { pastSectionHtml } from './dossier-ui-sections-parts/past-section.js';
export { secretsSectionHtml } from './dossier-ui-sections-parts/secrets-section.js';
export { sectionScreenHtml } from './dossier-ui-sections-parts/section-screen.js';
