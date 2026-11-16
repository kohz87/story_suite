// The Models page's roles: which Connection Manager profile name a role's calls use.

import { profileName } from '../model-call-parts/profiles.js';

/** The host setting that holds each role's profile; Story has none (it is always the chat's connection). */
export const ROLE_SETTING = Object.freeze({ quick: 'quickConnection', background: 'backgroundConnection' });

/** The profile name `role` ('story', 'quick' or 'background') uses, read from the host settings; '' is the chat's connection (also for Story and any other role). */
export function connectionFor(role, host) {
    const key = Object.hasOwn(ROLE_SETTING, role) ? ROLE_SETTING[role] : null;
    return key ? profileName(host?.[key]) : '';
}
