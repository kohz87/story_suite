// The Assist section's body (UI stage, step 3d): Story Block's two optional helpers on the form engine, in the concept's
// Assist page. Both make one cheap extra model call, and both are off until the reader turns them on:
//
// * Extra calls: the Connection Manager profile both helpers use (a cheaper model, say) and Story Suite's "one call at a time per
//   connection" switch (a host setting that used to sit in the Story Suite fold).
// * Checks: the pre-roll, "Roll checks before the reply": the check is rolled first, from the reader's message.
// * Safety net: reads the finished reply for change lines it forgot (time, place, who is here, weather, quest progress, wounds, an
//   item handed over). Its own profile, and the kinds it may write as chips. The value wall is stated plainly: coin, new items,
//   XP, loot and healing have no chip and are never written, whatever is stored; a line that arrives after the reader has already
//   sent the next message waits for the next reply and may not add anything but someone arriving. (There is no setting for that:
//   the code decides it, so the page only states it.)
// * Recent runs: what the helpers did lately (the old Assist panel, assist/section.js).
//
// The two switches are Features (MODULES §F100): they are written through the feature store, the one the Features page writes
// through, so the two pages always agree (a switch here redraws the other pages, and the Features page's redraws this). The profiles
// and the kinds are Story Block's settings (`assistProfile`, `assistExtractorProfile`, `assistExtractorKinds`), written through the
// same store as before. A row that cannot work now is **drawn and locked, with the reason**, never hidden: the safety net's profile
// and kinds while it is off, the pre-roll while no module keeps checks, the shared profile while both helpers are off, a profile
// select while the Connection Manager has no profile to pick.
// Public face: re-exports its parts.

export { ASSIST_MODULE, ASSIST_FOLD, ASSIST_HOST_KEYS, ASSIST_TEXT } from './assist-parts/text.js';
export { assistSchema } from './assist-parts/schema.js';
export { assistBody } from './assist-parts/body.js';
