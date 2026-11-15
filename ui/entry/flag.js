// Reads and writes the ui.next flag in SillyTavern's extension settings; both survive a context with no settings.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function readFlag(ctx) {
  return ctx?.extensionSettings?.storySuite?.ui?.next === true;
}

export function writeFlag(ctx, on) {
  const all = ctx?.extensionSettings;
  if (!isRec(all)) return false;
  if (!isRec(all.storySuite)) all.storySuite = {};
  if (!isRec(all.storySuite.ui)) all.storySuite.ui = {};
  all.storySuite.ui.next = on;
  ctx.saveSettingsDebounced?.();
  return true;
}
