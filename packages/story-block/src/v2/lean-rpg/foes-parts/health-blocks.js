// A Standard foe's Health blocks by level, in the usual and the harder-foes rule.
import { FOE_LEVEL } from './level-basics.js';

/** A Standard foe's Health blocks: 4 + floor(level / 30) (levels 1–29 give 4, 30–59 give 5, 60–89 give 6, 90–99 give 7). */
export const foeBlocksByLevel = level => FOE_LEVEL.healthBase + Math.floor(Math.max(FOE_LEVEL.min, Number(level) || 0) / FOE_LEVEL.healthStep);

/** The same under the harder-foes rule (a Foes block whose Health field holds up to `hardMax`, `isHardBar`): 12 + floor(level / 30), 12 to 15. */
export const hardBlocksByLevel = level => FOE_LEVEL.hardBase + Math.floor(Math.max(FOE_LEVEL.min, Number(level) || 0) / FOE_LEVEL.healthStep);

/** A foe Health field of the harder-foes rule: only a Foes block made from the new template holds that many blocks (an older block keeps its 8 and the old numbers). */
export const isHardBar = schema => Number.isFinite(schema?.max) && schema.max >= FOE_LEVEL.hardMax;
