// The Tools page's commands for the port: the diagnostics report text, and starting a blocked branch's dossiers again from the chat.

/**
 * `settings.action` with key `tools.report` → { ok: true, text } (the report to copy); `tools.rebuild` with `value` = { module, read: 'last-40' | 'all' }
 * → the engine's answer ({ ok, ... } or a failure). Any other command is not the Tools page's: returns null.
 */
export async function toolsCommand(tools, type, payload) {
  if (type !== 'settings.action') return null;
  const key = String(payload?.key ?? '');
  if (key !== 'tools.report' && key !== 'tools.rebuild') return null;
  if (!tools) return { ok: false, code: 'FAILED', message: 'The engine has no tools to read.' };
  if (key === 'tools.report') return { ok: true, text: String(await tools.report()) };
  const { module, read } = payload?.value ?? {};
  if (typeof module !== 'string' || (read !== 'last-40' && read !== 'all')) return { ok: false, code: 'FAILED', message: 'Choose how much of the chat to read.' };
  return tools.rebuild(module, read);
}
