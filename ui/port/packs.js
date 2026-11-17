// The Packs and trackers page's commands for the port: switch a pack on or off, import a pack file or the lorebook's packs, remove a pack, and use a data module in this chat.

import { importPicked, importFromLorebook } from '../../packs/import-run.js';

const NO = message => ({ ok: false, code: 'FAILED', message });

/**
 * `handle` = { packs (installed.js), readLorebook(), lore? ({ read() }) }; `sdk` sends the data-module command.
 * `settings.set` `packs.on.<id>` (bool) switches a pack; `settings.set` `packs.module.<module>` (true) uses a data module in this chat, as the old page's Enable did (`dm.pin` with the hashes read now);
 * `settings.action` `packs.import` (value: the picked files) → `{ ok, text, errors }`, `packs.lorebook`, `packs.remove` (value: the pack id).
 * Any other command is not this page's: returns null.
 */
export async function packsCommand(handle, sdk, type, payload) {
  const key = String(payload?.key ?? '');
  if (!key.startsWith('packs.') || (type !== 'settings.set' && type !== 'settings.action')) return null;
  const packs = handle?.packs;
  if (!packs) return NO('The engine has no packs to change.');
  if (type === 'settings.set' && key.startsWith('packs.on.')) {
    return (await packs.setEnabled(key.slice('packs.on.'.length), payload.value === true)) ? { ok: true } : NO('That pack is not installed.');
  }
  if (type === 'settings.set' && key.startsWith('packs.module.')) {
    const module = key.slice('packs.module.'.length);
    const row = (sdk?.query?.('dataModules.setup', {}) ?? []).find(item => item?.module === module);
    if (payload.value !== true) return NO('A data module in use cannot be switched off here.');
    if (!row || row.pinned || row.available === false) return NO('That data module cannot be used now.');
    return sdk.command('dm.pin', { module, hash: row.hash, packHash: row.packHash, subjects: [] });
  }
  if (type !== 'settings.action') return null;
  if (key === 'packs.import') {
    const done = await importPicked(packs, payload.value);
    return done ? { ok: done.errors.length === 0, ...done } : NO('No file was picked.');
  }
  if (key === 'packs.lorebook') { const done = await importFromLorebook(packs, handle.readLorebook, handle.lore ?? null); return { ok: done.errors.length === 0, ...done }; }
  if (key === 'packs.remove') {
    const id = String(payload.value ?? '');
    const name = packs.list().find(pack => pack.id === id)?.name ?? id;
    await packs.remove(id);
    return { ok: true, text: `Removed ${name}.`, errors: [] };
  }
  return null;
}
