// The Party tab's Export: asks the RPG for one member's saved character file (`rpg.characterFile`) and hands it back for the sheet to save.

/** `payload`: { member (the party id), inventory?, money? } → the query's answer ({ ok: true, name, fileName, text, ... } or { ok: false, message }), as the port's command answer. */
export function exportCommand(sdk, payload) {
  const fail = message => ({ ok: false, code: 'FAILED', message });
  let answer = null;
  try { answer = sdk?.query?.('rpg.characterFile', { id: String(payload?.member ?? ''), ...(payload?.inventory === false ? { inventory: false } : {}), ...(payload?.money === false ? { money: false } : {}) }); } catch { answer = null; }
  if (!answer || typeof answer !== 'object') return fail('The character file could not be made.');
  return answer.ok === true ? answer : fail(String(answer.message || 'The character file could not be made.'));
}
