// The limits and key shape that identify one cast person in Story Director's answer.

/** The most people one answer is read for. */
export const CAST_MAX = 200;
export const KEY_MAX = 120;
export const NAME_MAX = 120;
/** A cast key: "pack:id" (letters, digits and . _ : -). */
export const CAST_KEY = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,119}$/u;
