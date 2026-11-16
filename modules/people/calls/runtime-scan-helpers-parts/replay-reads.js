// Reads that honour the replay scope: the chat context, the clock and a toast (live: the real chat, Date.now and toastr).

import { getContext } from '../../../../../../../extensions.js';
import { replayScope } from './replay-state.js';

export function chatContext() {
    const replay = replayScope();
    const real = getContext();
    return replay ? Object.create(real, { chat: { value: replay.chat } }) : real;
}
export const clockNow = () => (replayScope() ? replayScope().now() : Date.now());
/** A toast: shown live, recorded in the sink during a replay. */
export function notify(kind, text) {
    const replay = replayScope();
    if (replay) replay.sink.toast(kind, text);
    else globalThis.toastr?.[kind]?.(text);
}
