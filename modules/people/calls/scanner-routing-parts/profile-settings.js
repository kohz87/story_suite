/* NPC State Delta: the scanner settings read from the host and the profile choices offered. */
import { normalizeScannerMaxOutputTokens } from './shared-limits.js';

export function configuredScannerMaxOutputTokens(ctx) {
    return normalizeScannerMaxOutputTokens(ctx?.extensionSettings?.npc_state_delta?.scannerMaxOutputTokens);
}

/**
 * The Connection Manager profile id the scanner uses: the Models page's Background connection (a profile name in the
 * Story Suite host settings), looked up by name. '' is the current roleplay connection. A name no profile has any more
 * is returned as it is, so the scan fails closed on a missing profile instead of falling back.
 */
export function selectedScannerProfileId(ctx) {
    const value = ctx?.extensionSettings?.storySuite?.host?.backgroundConnection;
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name.toLowerCase() === 'chat') return '';
    const profiles = ctx?.extensionSettings?.connectionManager?.profiles;
    const found = Array.isArray(profiles) ? profiles.find(profile => typeof profile?.id === 'string' && String(profile.name || profile.id) === name) : null;
    return found ? found.id : name;
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
