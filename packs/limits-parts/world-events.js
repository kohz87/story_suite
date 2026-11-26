// The world pack: event kinds, certainty, reach and the event field list.

export const EVENT_KINDS = Object.freeze(['one-off', 'chain-stage', 'recurring']);
export const EVENT_CERTAINTY = Object.freeze(['set-in-motion', 'likely', 'possible']);
export const EVENT_REACH = Object.freeze(['local', 'regional', 'realm', 'world']);
export const WORLD_EVENT_FIELDS = Object.freeze(['id', 'kind', 'certainty', 'reach', 'severity', 'title', 'where', 'requires', 'requires_any', 'window', 'chance', 'cooldown', 'likelier_if', 'less_if', 'pre_empted_by', 'anchor_mode', 'outcomes', 'effects', 'ends_when', 'summary', 'even_in_party', 'on', 'waits_for']);
