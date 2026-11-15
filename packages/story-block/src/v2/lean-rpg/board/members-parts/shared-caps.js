// The group-size cap (five, or six under the six-group rule) and the test for a foe that is a pack.

import { num } from './shared-numbers.js';

export const MEMBER_CAP = 5;
export const MEMBER_CAP_SIX = 6;
export const capOf = six => (six === true ? MEMBER_CAP_SIX : MEMBER_CAP);
export const isPack = (foe, six = false) => num(foe?.count) > capOf(six);
