// This page's one storage identity and its writer id (storage-identity.js): every sidecar write and lock of this page carries the same writer id.

import { createStorageIdentity } from './storage-identity.js';

export const identity = createStorageIdentity();

export const writerId = identity.currentWriterId();
