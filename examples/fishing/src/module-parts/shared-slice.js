// Views of the fishing slice: the slice itself, a plain copy of a value and the open line as the widget shows it.
import { initial } from './validate.js';
import { waitingOf } from './shared-session.js';

export const sliceOf = state => state?.domains?.fishing ?? initial();
export const copy = value => JSON.parse(JSON.stringify(value));

// The open line as the widget shows it: { id, spot, bait, bite, window } (times in ms), or null.
export function openLine(fishing) {
    const open = waitingOf(fishing);
    return open ? copy({ id: open.id, spot: open.spot, bait: open.bait, bite: open.bite.bite, window: open.bite.window }) : null;
}
