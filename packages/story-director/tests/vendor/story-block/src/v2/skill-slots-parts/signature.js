// The signature mark of a skill slot: the field name and the test of one slot's bit.
import { SKILL_FIELDS_MAX } from './layout.js';
export const SIGNATURE_FIELD = 'sig';
export const signatureAt = (value, slot) => Number.isSafeInteger(value) && value > 0 && Number.isSafeInteger(slot) && slot >= 1 && slot <= SKILL_FIELDS_MAX && (value >> (slot - 1)) % 2 === 1;
