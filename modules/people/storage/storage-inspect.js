// The sidecar inspection bound to this page's file names (storage-inspection.js): adopt, inspect, probe a pointer and read a remote revision.

import { createStorageInspection } from './storage-inspection.js';
import { dataFileExists } from './storage-files.js';
import { decodeStateFilePayload, decodeStateFileHead } from './storage-payload.js';
import { identity } from './storage-self.js';

const inspection = createStorageInspection({ dataFileExists, decodeStateFilePayload, decodeStateFileHead, makeNpcStateDataFileName: identity.makeNpcStateDataFileName });

export const { adoptNpcStateDataFileMetadata, inspectNpcStateDataFile, probeNpcStateDataFilePointer, remoteRevision } = inspection;
