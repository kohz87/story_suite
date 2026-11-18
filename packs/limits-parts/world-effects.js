// The world pack: the field lists of effects, cast effects, templates and condition effects.

export const EFFECT_FIELDS = Object.freeze(['set', 'clear', 'cast', 'powers', 'scores', 'facts', 'on_end']);
export const CAST_EFFECT_FIELDS = Object.freeze(['who', 'location', 'status', 'goal', 'died', 'until', 'routine', 'from']);
export const TEMPLATE_FIELDS = Object.freeze(['template', 'scope', 'severity', 'reach', 'needs', 'requires', 'requires_any', 'likelier_if', 'less_if', 'sets', 'clears', 'chance', 'cooldown', 'per', 'where', 'open', 'arc', 'fallback', 'summary']);
export const CONDITION_EFFECT_FIELDS = Object.freeze(['prices', 'routes']);
