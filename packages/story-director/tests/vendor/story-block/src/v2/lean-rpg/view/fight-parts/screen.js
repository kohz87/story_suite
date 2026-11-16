// The Fight screen record (tab and game-view screen) and the ids of its widget and screen.

import { RPG_STRINGS } from '../../strings.js';
import { hasFoes } from './data.js';

const F = RPG_STRINGS.fight;
export const FIGHT_WIDGET = 'rpg.fight';
/** The id ends in `fight`, so the navigation puts the tab at Fight's place (screens.js DEFAULT_ORDER). */
export const FIGHT_SCREEN_ID = 'story-block/fight';

/** The Fight screen: a tab and a game-view screen, on only while a foe slot is filled, a pause waits or a board fight is kept (`kept`). `roleOf` as for the readers. */
export function createFightScreen({ roleOf, offer = () => false, waiting = () => false, kept = () => false } = {}) {
    return Object.freeze({
        id: FIGHT_SCREEN_ID, title: F.title, icon: 'fa-skull', mounts: Object.freeze(['screen', 'tab']),
        template: `<ss-widget name="${FIGHT_WIDGET}"></ss-widget>`,
        active: state => ({ on: hasFoes(state, { roleOf }) || waiting() || kept(), ...(offer() ? { badge: 'Fight offer open' } : {}) }),
        activeNote: 'Shown only while a foe is in the Foes block, a fight pause waits, or a board fight is kept.',
    });
}
