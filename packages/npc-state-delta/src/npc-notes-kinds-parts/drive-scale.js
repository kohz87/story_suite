// The scale function that applies one person's drives to the instinct scores.
import { readDrives, applyStrength } from '../npc-notes-drives.js';

/** The scale function for npc-instincts' readInstincts: a score scaled by this person's drive for that instinct key (belo, clos, awe). */
export function driveScale(leaf) {
    const drives = readDrives(leaf);
    return drives ? (key, score) => applyStrength(score, drives[key]) : undefined;
}
