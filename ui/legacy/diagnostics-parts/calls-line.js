// The model-call queue line of the report.
import { num } from './shared-format.js';

/**
 * The queue line (model-call.js createCallQueue().stats()): "One at a time per connection: on. Waiting now: 1
 * (chat: 1). Calls that waited: 3, 2.4 s in all, longest 1.2 s." Only counts and times, never a profile's details.
 */
export function callsLine(calls) {
    if (!calls || typeof calls !== 'object') return 'One at a time per connection: unknown (no queue here).';
    const secs = ms => `${Math.round((Number(ms) || 0) / 100) / 10} s`;
    const lanes = Object.entries(calls.lanes ?? {}).length;
    const head = `One at a time per connection: ${calls.on === false ? 'off' : 'on'}. Waiting now: ${num(calls.waiting ?? 0)}${lanes ? ` on ${lanes} connection${lanes === 1 ? '' : 's'}` : ''}. Running: ${num(calls.running ?? 0)}.`;
    return `${head} Calls that waited: ${num(calls.waited ?? 0)}, ${secs(calls.waitedMs)} in all, longest ${secs(calls.longestMs)}.`;
}
