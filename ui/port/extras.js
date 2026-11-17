// The Settings › Chat extras page's commands for the port: the two Inner chatter rows and the Choices, Inner chatter and Your look switches.

import { EXTRAS_MODULE, EXTRAS_FEATURES, EXTRAS_SETTINGS } from '../select/extras-keys.js';

const NO = message => ({ ok: false, code: 'FAILED', message });
const PREFIX = /^modules\.(?:chat|newChats)\.extras(?:\.(.+))?$/;

/**
 * `settings.set` with key `extras.sendBack` / `extras.chatterLines` stores Story Block's `chatterInPrompt` / `chatterMax` (the same
 * stores the old view's Inner chatter group writes; the schema clamps the number to 1–10); `modules.<scope>.extras.<choices|chatter|you>`
 * switches that feature, and `modules.<scope>.extras` (the module's master switch) all three. Other commands are not this page's: returns null.
 */
export function extrasCommand(type, payload, writes = null) {
  if (type !== 'settings.set') return null;
  const key = String(payload?.key ?? '');
  const value = payload?.value;
  if (Object.hasOwn(EXTRAS_SETTINGS, key)) {
    const stored = writes?.settings?.set?.(EXTRAS_MODULE, EXTRAS_SETTINGS[key], value);
    return stored === undefined ? NO('That setting was not saved.') : { ok: true, value: stored };
  }
  const match = PREFIX.exec(key);
  if (!match) return null;
  const names = match[1] === undefined ? Object.keys(EXTRAS_FEATURES) : Object.hasOwn(EXTRAS_FEATURES, match[1]) ? [match[1]] : [];
  if (!names.length) return NO('That switch is not on this page.');
  for (const name of names) if (writes?.features?.set?.(EXTRAS_FEATURES[name], value === true) === undefined) return NO('That switch was not saved.');
  return { ok: true, value: value === true };
}
