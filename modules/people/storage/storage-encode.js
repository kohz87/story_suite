// Encodes a chat's state (or its retired marker) as a sidecar payload stamped with this page's writer id.

import { encodeStateFilePayload as encodeStateFilePayloadFile, encodeRetiredStateFilePayload as encodeRetiredStateFilePayloadFile } from './storage-payload.js';
import { writerId } from './storage-self.js';

export function encodeStateFilePayload(chatKey, state, appVersion = '', metadata = {}) {
    return encodeStateFilePayloadFile(chatKey, state, appVersion, metadata, writerId);
}

export function encodeRetiredStateFilePayload(chatKey, reason = 'retired', appVersion = '', metadata = {}) {
    return encodeRetiredStateFilePayloadFile(chatKey, reason, appVersion, metadata, writerId);
}
