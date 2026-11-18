// Story Director v2, world: the world-events switch and the courier's pace setting (pure).

import { COURIER_KM_PER_DAY } from '../../atlas/atlas/courier.js';

/** The feature switch of the world-events mechanism (default off): with it off nothing here changes what the story or the model sees. */
export const WORLD_EVENTS = 'story-director.world-events';

/** Whether the switch is on (`tools.feature` / `view.feature`); a host without features has it off. */
export function worldEventsOn(source) {
    try { return typeof source?.feature === 'function' && source.feature(WORLD_EVENTS) === true; } catch { return false; }
}

/** The courier's km a day from the settings (`courierKmPerDay`), 60 when absent or bad. */
export function courierSpeed(tools) {
    let value;
    try { value = typeof tools?.settings === 'function' ? tools.settings()?.courierKmPerDay : undefined; } catch { value = undefined; }
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : COURIER_KM_PER_DAY;
}
