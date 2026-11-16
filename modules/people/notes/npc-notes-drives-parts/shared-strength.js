// Strength checks shared by the drive parts: the known keys, the strength test and the all-default drives.
import { DRIVE_MIN, DRIVE_MAX, DRIVE_DEFAULT } from './shared-limits.js';
import { DRIVES } from './shared-table.js';

export const KEYS = new Set(DRIVES.map(drive => drive.key));

export const isStrength = value => Number.isInteger(value) && value >= DRIVE_MIN && value <= DRIVE_MAX;
export const defaults = () => Object.fromEntries(DRIVES.map(drive => [drive.key, DRIVE_DEFAULT]));
