// Story Director v2, names: reading the stored slice tables, the identity of a seen person and the reply revision.

import { sha256 } from '../../../world/hash.js';
import { MAX_NAME } from './limits.js';
import { nameKey } from './keys.js';
import { MAX_ALIASES, isInt } from './slice-limits.js';
import { isRecord } from './host-read.js';

export const tables = slice => ({ people: isRecord(slice?.people) ? slice.people : {}, seen: isRecord(slice?.seen) ? slice.seen : {}, taken: isRecord(slice?.taken) ? slice.taken : {} });
export const identityKey = entry => `@${sha256(JSON.stringify([entry.source, entry.name, entry.aliases])).slice(0, 24)}`;
export const identityOk = entry => isRecord(entry) && typeof entry.source === 'string' && entry.source.length > 0 && entry.source.length <= 200 && typeof entry.name === 'string' && !!nameKey(entry.name) && Array.from(entry.name).length <= MAX_NAME && Array.isArray(entry.aliases) && entry.aliases.length <= MAX_ALIASES && entry.aliases.every(alias => typeof alias === 'string' && !!nameKey(alias) && Array.from(alias).length <= MAX_NAME);
export const revOf = ctx => (isInt(ctx?.rev) ? ctx.rev : 0);
