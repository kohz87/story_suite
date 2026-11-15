// Decoding a native bundle together with its checked declared-contents metadata.
import { decodeNpcStateBundle } from '../bundle.js';
import { parseEnvelope } from './envelope.js';
import { validateDeclaredContents, validatePortableSettings, validateHistoryArchive } from './validate.js';

export function decodeDeltaNativeBundle(input) {
    const canonical = decodeNpcStateBundle(input);
    const { manifest } = parseEnvelope(input);
    const declaredContents = validateDeclaredContents(manifest.declaredContents);
    const portableSettings = validatePortableSettings(manifest.portableSettings);
    const historyArchive = validateHistoryArchive(manifest.historyArchive);
    if (declaredContents?.portablePortraitSettings === true && !portableSettings) throw new Error('NPC State Delta native bundle declares portable portrait settings but does not contain them.');
    if (declaredContents?.sourceHistoryAudit === true && !historyArchive) throw new Error('NPC State Delta native bundle declares source history but does not contain it.');
    return { ...canonical, declaredContents, portableSettings, historyArchive };
}
