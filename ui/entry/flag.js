// The view choice on this device: the new view, unless this device asked for the old one (Settings › Tools › Developer tools › Use the old view).

/** The localStorage key that holds this device's "Use the old view" choice ('1' while it is on). */
export const OLD_VIEW_KEY = 'storySuite.ui.oldView';
/** The body class the new view carries while it is shown; suite.css hides the old view's chat furniture under it. */
export const NEW_VIEW_CLASS = 'ss-ui-next';

const deviceStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** True when this device chose the old view; false with no storage or anything else stored. */
export function readOldView(storage = deviceStorage()) {
  try { return storage?.getItem?.(OLD_VIEW_KEY) === '1'; } catch { return false; }
}

/** Stores this device's choice (on: '1'; off: the key is removed). Returns false when there is no storage to keep it. */
export function writeOldView(on, storage = deviceStorage()) {
  try {
    if (on) storage.setItem(OLD_VIEW_KEY, '1');
    else storage.removeItem(OLD_VIEW_KEY);
    return true;
  } catch { return false; }
}
