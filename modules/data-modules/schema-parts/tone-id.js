// The default tone of a status value and the shape of a module id.

/** The tone a status value has unless the author changed it: active, done and failed by name, anything else neutral. */
export const dmDefaultTone = value => (['active', 'done', 'failed'].includes(value) ? value : 'neutral');
export const dmId = value => typeof value === 'string' && /^pack\.[a-z0-9][a-z0-9-]{0,39}\/[a-z0-9][a-z0-9-]{0,39}$/.test(value);
