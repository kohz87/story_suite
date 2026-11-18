// The Tools page's commands for the port: the diagnostics report text, and starting a blocked branch's dossiers again from the chat.

const KEYS = ['tools.report', 'tools.rebuild', 'tools.gamepack.export', 'tools.savepoint.make', 'tools.savepoint.return', 'tools.savepoint.forget'];

/**
 * `settings.action` with key `tools.report` → { ok: true, text } (the report to copy); `tools.gamepack.export` (value { name }) → { ok, pack, text, sections } or { ok: false, message }; `tools.rebuild` with `value` = { module, read: 'last-40' | 'all' }
 * → the engine's answer ({ ok, ... } or a failure). `tools.savepoint.make` (value { name }), `.return` and `.forget` (value { id }) → the save points' answer. Any other command is not the Tools page's: returns null.
 */
export async function toolsCommand(tools, type, payload) {
  if (type !== 'settings.action') return null;
  const key = String(payload?.key ?? '');
  if (!KEYS.includes(key)) return null;
  if (!tools) return { ok: false, code: 'FAILED', message: 'The engine has no tools to read.' };
  if (key === 'tools.report') return { ok: true, text: String(await tools.report()) };
  if (key === 'tools.gamepack.export') return tools.exportGamePack(String(payload?.value?.name ?? ''));
  if (key.startsWith('tools.savepoint.')) {
    const v = payload?.value ?? {};
    if (key === 'tools.savepoint.make') return tools.makeSavePoint(String(v.name ?? ''));
    return key === 'tools.savepoint.return' ? tools.returnToSavePoint(String(v.id ?? '')) : tools.forgetSavePoint(String(v.id ?? ''));
  }
  const { module, read } = payload?.value ?? {};
  if (typeof module !== 'string' || (read !== 'last-40' && read !== 'all')) return { ok: false, code: 'FAILED', message: 'Choose how much of the chat to read.' };
  return tools.rebuild(module, read);
}
