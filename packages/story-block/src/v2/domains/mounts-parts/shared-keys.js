// The keys a mount's name makes, for the mounts parts.

import { cleanName } from '../names.js';
import { foldKey } from '../../../text.js';

export const nameKey = name => foldKey(cleanName(name));

export const rowKey = name => `m:${nameKey(name)}`;
