// The world pack: the field lists of effects, cast effects, templates and condition effects.

export const EFFECT_FIELDS = Object.freeze(['set', 'clear', 'cast', 'powers', 'scores', 'facts', 'on_end']);
export const CAST_EFFECT_FIELDS = Object.freeze(['who', 'location', 'status', 'goal', 'died', 'until', 'routine']);
export const TEMPLATE_FIELDS = Object.freeze(['template', 'scope', 'severity', 'reach', 'needs', 'sets', 'clears', 'chance', 'cooldown', 'where', 'summary']);
export const CONDITION_EFFECT_FIELDS = Object.freeze(['prices', 'routes']);
