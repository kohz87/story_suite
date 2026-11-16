/* NPC State Delta: the scanner settings read from the host and the profile choices offered. */
import { normalizeScannerMaxOutputTokens } from './shared-limits.js';
import { npcBucket } from '../../settings/bucket.js';

export function configuredScannerMaxOutputTokens(ctx) {
    return normalizeScannerMaxOutputTokens(npcBucket(ctx?.extensionSettings)?.scannerMaxOutputTokens);
}

export function selectedScannerProfileId(ctx) {
    const value = npcBucket(ctx?.extensionSettings)?.scannerConnectionProfile;
    return typeof value === 'string' ? value.trim() : '';
}

export function connectionManagerDisabled(ctx) {
    return ctx?.extensionSettings?.disabledExtensions?.includes?.('connection-manager') === true;
}

export function scannerProfileOptions(ctx, selected = selectedScannerProfileId(ctx)) {
    const options = [{ id: '', name: 'Use current roleplay connection' }];
    const service = ctx?.ConnectionManagerRequestService;
    const profiles = ctx?.extensionSettings?.connectionManager?.profiles;
    if (!connectionManagerDisabled(ctx) && Array.isArray(profiles)) {
        for (const profile of profiles) {
            if (typeof profile?.id !== 'string' || !profile.id.trim()) continue;
            try {
                if (typeof service?.isProfileSupported === 'function' && !service.isProfileSupported(profile)) continue;
            } catch { continue; }
            if (!options.some(option => option.id === profile.id)) {
                options.push({ id: profile.id, name: String(profile.name || profile.id) });
            }
        }
    }
    if (selected && !options.some(option => option.id === selected)) {
        options.push({ id: selected, name: `Unavailable profile (${selected})` });
    }
    return options;
}
