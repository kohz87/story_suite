// The fight kind's plain members (what the registry reads and the screens show): shared by the kind itself and the lazy stand-in the core module registers,
// so the page start never loads the engine (the functions are handed over once the RPG's library is there: rpg-lazy-parts/fight-kind.js).
import { CORE_FEATURE } from '../../features.js';
import { BOARD_AWARD, BOARD_CLEAR_FOES, BOARD_HURTS, BOARD_OPEN_FOES, LEAN_RPG_FEATURE } from '../names.js';

export const FIGHT_STATIC = Object.freeze({
    version: 1, title: 'Fight', feature: CORE_FEATURE.fightBoard, screen: 'story-block/fight', limits: Object.freeze({ stepInputs: 32 }),
    changes: Object.freeze(['gear.wear', 'inventory.consume', BOARD_OPEN_FOES, BOARD_HURTS, BOARD_CLEAR_FOES, BOARD_AWARD]),
    marker: Object.freeze({ word: 'battle', feature: LEAN_RPG_FEATURE }), carry: true,
    // (a staged fight goes with the reader's next message, as it always did; only a waiting pause asks for "Send with this fight")
    autoSend: true,
});
