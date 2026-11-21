// How much story history is kept step by step (docs/dev/saves-and-persist.md "Sealed history"): the last SEAL_WINDOW replies always,
// the ones before them sealed in steps of SEAL_STEP (so between SEAL_WINDOW and SEAL_WINDOW + SEAL_STEP - 1 replies stay whole).
export const SEAL_WINDOW = 50;
export const SEAL_STEP = 25;
