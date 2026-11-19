// The sidecar names of this page's storage identity: the data and recovery file names, the writer id reader and the short hash for lock names.

import { identity } from './storage-self.js';

export const { fnv1a } = identity;

export const currentWriterId = identity.currentWriterId;

export const makeNpcStateDataFileName = identity.makeNpcStateDataFileName;

export const makeNpcStateRecoveryFileName = identity.makeNpcStateRecoveryFileName;
