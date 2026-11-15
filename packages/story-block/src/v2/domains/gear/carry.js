// Gear's carry rules: mount capacity, a member's capacity, the whole carry picture and the carry query's answer
// (moved out of domains/gear.js unchanged; gear.js re-exports every public name). The picture uses the supplied carry reader.
// Public face: re-exports its parts.

export { KIND_CARRY, OTHER_CARRY, kindCarry, itemCarryOf } from './carry-parts/mount-kinds.js';
export { travelsWith } from './carry-parts/mount-travel.js';
export { capacityFor, atLimit, loadLevel } from './carry-parts/load.js';
export { carryPicture, carryAnswer } from './carry-parts/picture.js';
