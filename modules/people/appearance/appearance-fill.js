/* Appearance fill (role: appearance-fill). When a NEW person is met (their one new-admission backfill, or the catch-up Refresh, or the reader presses Refresh), that call may fill
   what the story never described: BLANK look fields (overallAppearance, appearance), and the hair, eyes and build MISSING from a
   PARTIAL overallAppearance ("Young human woman"), with details that fit what the story has said.
   This file owns: who qualifies (alive, not archived, no named forms, appearance not manually fixed), which of hair / eyes / build
   a text already describes (pure word lists), the one prompt line, the clash check on an appended addition, and the name of the
   merge option that lets this one call write without quoted evidence. Nothing is stored for it: the filled text is an ordinary
   value, so a later explicit story line replaces it through the normal refine gate. A partial text is only ever EXTENDED: the
   line quotes the exact stored overallAppearance (and, apart, the clothes text; the dossier shows both joined by ';'), the model
   returns that text plus the addition, and code accepts it only when the quoted text survives word for word (appendedLooks; its
   closing full stop may give way to the addition's comma). Pure.
   Public face: re-exports its parts. */
export { describedFeatures, missingFeatures } from './appearance-fill-parts/features.js';
export { splitLook, withSplitLook } from './appearance-fill-parts/split-look.js';
export { agreeWithStoredAge } from './appearance-fill-parts/age.js';
export { blankLookFields, partialLookGaps, fillWanted } from './appearance-fill-parts/wanted.js';
export { isReadersOwn, fillAllowed } from './appearance-fill-parts/gate.js';
export { fillLooksLine } from './appearance-fill-parts/line.js';
export { attemptsExtension, appendedLooks, FILL_MERGE_OPTION } from './appearance-fill-parts/append.js';
