// `--flags name=value,...`: settings flags (extension_settings.storySuite.flags) set on the host before a chat is loaded.

/** "a=true,b=false" → { a: true, b: false }. true/false are booleans; any other value stays text. */
export function parseFlagList(text) {
  const flags = {};
  for (const part of String(text ?? '').split(',').map(item => item.trim()).filter(Boolean)) {
    const at = part.indexOf('=');
    if (at <= 0) throw new Error(`--flags: "${part}" is not name=value`);
    const value = part.slice(at + 1).trim();
    flags[part.slice(0, at).trim()] = value === 'true' ? true : value === 'false' ? false : value;
  }
  return flags;
}

/** Sets the flags on the host's settings (Story Block reads them on every call). No flags: nothing is touched. */
export function applyFlags(host, flags) {
  const names = Object.keys(flags ?? {});
  if (names.length === 0) return;
  const root = host.ctx.extensionSettings ?? (host.ctx.extensionSettings = {});
  root.storySuite ??= {};
  root.storySuite.flags = { ...(root.storySuite.flags ?? {}), ...flags };
}
