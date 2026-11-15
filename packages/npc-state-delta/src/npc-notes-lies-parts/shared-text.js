// Text helpers shared by the lie parts: the id and name caps, the code-point clip and the same-name test.
import { LIE_TO_MAX } from './shared-limits.js';

export const ID_MAX = 200;
export const NAME_MAX = 120;

// Code points, not UTF-16 units, so the same cut as the neighbours (npc-notes-knows.js) and a cut never splits a character.
export const clip = (value, max) => [...String(value ?? '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();

export const sameName = (a, b) => clip(a, LIE_TO_MAX).toLowerCase() === clip(b, LIE_TO_MAX).toLowerCase();
