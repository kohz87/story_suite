// The start pieces' widget and screen ids, and the hold dialog's screen.

import { RPG_STRINGS } from '../../strings.js';

const S = RPG_STRINGS.start;
export const START_WIDGET = 'story-block.rpg-start';
export const HOLD_SCREEN_ID = 'story-block/rpg-hold';
export const HOLD_WIDGET = 'rpg.hold';

/** The hold dialog's screen: one body, drawn by the hold widget. */
export function createHoldScreen() {
    return Object.freeze({
        id: HOLD_SCREEN_ID, title: S.holdTitle, icon: 'fa-user-plus', mounts: Object.freeze(['dialog']),
        template: `<ss-widget name="${HOLD_WIDGET}"></ss-widget>`,
    });
}
