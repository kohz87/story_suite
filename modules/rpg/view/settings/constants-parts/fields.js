// The Standard Custom-number fields: the roll's numbers, then creation's.

import { LEVEL } from '../../../names.js';
import { S } from './shared-words.js';

// The level divisor row (Custom): 3 to 8, 5 unset; it replaces the Soul Class weight row, which a levelled roll no longer reads.
const DIVISORS = Object.freeze(Array.from({ length: LEVEL.maxDivisor - LEVEL.minDivisor + 1 }, (_, n) => LEVEL.minDivisor + n));

// Standard's Custom numbers: the roll's, then creation's.
export const STANDARD_FIELDS = Object.freeze([
    Object.freeze({ key: 'foeBase', label: S.foeBase, help: S.foeBaseHelpStandard }),
    Object.freeze({ key: 'foeClassWeight', label: S.foeClassWeight, help: S.foeClassWeightHelp }),
    Object.freeze({ key: 'levelDivisor', label: S.levelDivisor, help: S.levelDivisorHelp, options: Object.freeze(DIVISORS.map(n => [n, `÷${n}`])) }),
    Object.freeze({ key: 'costMargin', label: S.costMargin, help: S.costMarginHelp }),
    Object.freeze({ key: 'decisiveMargin', label: S.decisiveMargin, help: S.decisiveMarginHelp }),
    Object.freeze({ key: 'roundCap', label: S.roundCap, help: S.roundCapHelp }),
    Object.freeze({ key: 'quickStartMargin', label: S.quickStartMargin, help: S.quickStartMarginHelp }),
    Object.freeze({ key: 'startStat', label: S.startStat, help: S.startStatHelp }),
    Object.freeze({ key: 'createPoints', label: S.createPoints, help: S.createPointsHelp }),
    Object.freeze({ key: 'createMin', label: S.createMin, help: S.createMinHelp }),
    Object.freeze({ key: 'createMax', label: S.createMax, help: S.createMaxHelp }),
    Object.freeze({ key: 'pointsPerSoul', label: S.pointsPerSoul, help: S.pointsPerSoulHelp }),
    Object.freeze({ key: 'statMax', label: S.statMax, help: S.statMaxHelp }),
]);
