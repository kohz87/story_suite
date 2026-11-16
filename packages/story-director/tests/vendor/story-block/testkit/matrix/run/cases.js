// The matrix runner's §2 extra cases, moved unchanged from run.js: missing query, malformed answer,
// feature off, unset clock, disabled SD, late registration and duplicate name.
//
// Public face: re-exports its parts.

export { missingQuery, malformed } from './cases-parts/peers.js';
export { featureOff, unsetClock } from './cases-parts/features.js';
export { disabledSd, lateRegistration, duplicateName } from './cases-parts/registration.js';
