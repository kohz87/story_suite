// Connection Manager profiles: a profile name as stored and the list for a dropdown.

import { cutAt } from '../text.js';
import { MODEL_CALL_TEXT } from './messages.js';
import { PROFILE_NAME_MAX, CHAT_PROFILE } from './shared-consts.js';
import { context } from './shared-helpers.js';

/** A profile setting or argument as stored: trimmed, cut at PROFILE_NAME_MAX; '' (the chat's) for 'chat' or nothing. */
export function profileName(value) {
    if (typeof value !== 'string') return '';
    const name = cutAt(value.trim(), PROFILE_NAME_MAX).trim();
    return name.toLowerCase() === CHAT_PROFILE ? '' : name;
}

export const cmDisabled = ctx => ctx?.extensionSettings?.disabledExtensions?.includes?.('connection-manager') === true;

/**
 * The Connection Manager's profiles for a dropdown: { usable, why, profiles: [{ id, name }] }, by name.
 * `usable` is false (with `why`) when SillyTavern has no Connection Manager or it is turned off. Only the
 * profiles that can make a text call (its isProfileSupported), and only their id and name: never an
 * address, key or other field.
 */
export function listProfiles(ctx = context()) {
    if (!ctx) return { usable: false, why: MODEL_CALL_TEXT.noSt, profiles: [] };
    if (cmDisabled(ctx)) return { usable: false, why: MODEL_CALL_TEXT.listCmOff, profiles: [] };
    const service = ctx.ConnectionManagerRequestService;
    if (typeof service?.sendRequest !== 'function') return { usable: false, why: MODEL_CALL_TEXT.listNoCm, profiles: [] };
    const list = ctx.extensionSettings?.connectionManager?.profiles;
    const profiles = [];
    for (const profile of Array.isArray(list) ? list : []) {
        if (typeof profile?.id !== 'string' || !profile.id.trim()) continue;
        try {
            if (typeof service.isProfileSupported === 'function' && !service.isProfileSupported(profile)) continue;
        } catch { continue; }
        const name = String(profile.name || profile.id);
        if (profiles.some(item => item.id === profile.id)) continue;
        profiles.push({ id: profile.id, name });
    }
    profiles.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en'));
    return { usable: true, why: '', profiles };
}
