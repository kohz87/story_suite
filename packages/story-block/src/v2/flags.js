// Reads Story Block's internal rollout flags from `extension_settings.storySuite.flags`: not Features, no UI, off unless set to true.

export const FLAGS = Object.freeze({
    peopleInStore: 'suite.peopleInStore',
    isolatedApply: 'suite.isolatedApply',
    redrawScheduler: 'suite.redrawScheduler',
    worldPeopleOwn: 'suite.worldPeopleOwn',
});

/**
 * Whether the flag `name` is on. `root` is the extension-settings root, or a function returning it; it is read on
 * every call, so a change in the settings takes effect at once. Anything but a stored `true` reads as off.
 */
export function flagOn(root, name) {
    try {
        const settings = typeof root === 'function' ? root() : root;
        return settings?.storySuite?.flags?.[name] === true;
    } catch { return false; }
}
