// Adding the declared Stage 8 metadata (portable settings, source history) to a native bundle within the size limits.
import { decodeNpcStateBundle } from '../bundle.js';
import { MAX_MANIFEST_BYTES, MAX_NATIVE_BYTES, parseEnvelope, encodeAugmentedEnvelope } from './envelope.js';
import { validatePortableSettings, validateHistoryArchive } from './validate.js';
import { compactHistoryArchive } from './history-archive.js';

function writeOptionalManifestFields(manifest, checkedSettings, checkedHistory) {
    manifest.declaredContents = {
        dossiers: true,
        portraits: true,
        socialGraph: true,
        dismissedIdentitySuppression: true,
        portablePortraitSettings: Boolean(checkedSettings),
        sourceHistoryAudit: Boolean(checkedHistory),
        historyRestorePolicy: 'target-safe-baseline',
    };
    if (checkedSettings) manifest.portableSettings = checkedSettings;
    else delete manifest.portableSettings;
    if (checkedHistory) manifest.historyArchive = checkedHistory;
    else delete manifest.historyArchive;
}

export function augmentNativeBundle(input, { portableSettings = null, historyArchive = null } = {}) {
    const { value, manifest, binary } = parseEnvelope(input);
    decodeNpcStateBundle(value);
    const checkedSettings = portableSettings === null ? null : validatePortableSettings(portableSettings);
    const checkedHistory = historyArchive === null ? null : validateHistoryArchive(historyArchive);
    const historyCandidates = checkedHistory
        ? [checkedHistory, compactHistoryArchive(checkedHistory), null]
        : [null];
    let lastManifestBytes = 0;
    let lastTotal = 0;
    for (const candidate of historyCandidates) {
        writeOptionalManifestFields(manifest, checkedSettings, candidate);
        const encoded = encodeAugmentedEnvelope(value, manifest, binary);
        lastManifestBytes = encoded.manifestBytes.length;
        lastTotal = encoded.total;
        if (lastManifestBytes <= MAX_MANIFEST_BYTES && lastTotal <= MAX_NATIVE_BYTES) return encoded.build();
    }
    if (lastManifestBytes > MAX_MANIFEST_BYTES) throw new Error('NPC State Delta native bundle manifest exceeds the 2 MB safety limit even without source-history audit data.');
    throw new Error('NPC State Delta native bundle exceeds the 32 MB safety limit even without source-history audit data.');
}
