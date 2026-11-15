// Arc command names and feature-tagged command registry.

import { FEATURE } from '../domain.js';
import { acceptArc } from './accept.js';
import { endArc, updateArc } from './update-end.js';

export const ACCEPT = 'director.arc.accept';
export const UPDATE = 'director.arc.update';
export const END = 'director.arc.end';

const tagged = fn => Object.assign(fn, { feature: FEATURE });

export const commands = Object.freeze({
    [ACCEPT]: tagged((ctx, payload) => acceptArc(ctx, payload)),
    [UPDATE]: tagged((ctx, payload) => updateArc(ctx, payload)),
    [END]: tagged((ctx, payload) => endArc(ctx, payload)),
});
