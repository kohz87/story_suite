// The Party tab's Export: asks the RPG for one member's saved character file (`rpg.characterFile`), or the query a plug-in sheet's row names, and hands it back for the sheet to save.

const QUERY_NAME = /^[A-Za-z][\w.-]{0,79}$/;

/** `payload`: { member (the party id), via? (the row's own export query), inventory?, money? } → the query's answer ({ ok: true, name, fileName, text, ... } or { ok: false, message }), as the port's command answer. */
export function exportCommand(sdk, payload) {
  const fail = message => ({ ok: false, code: 'FAILED', message });
  let answer = null;
  try { answer = sdk?.query?.(typeof payload?.via === 'string' && QUERY_NAME.test(payload.via) ? payload.via : 'rpg.characterFile', { id: String(payload?.member ?? ''), ...(payload?.inventory === false ? { inventory: false } : {}), ...(payload?.money === false ? { money: false } : {}) }); } catch { answer = null; }
  if (!answer || typeof answer !== 'object') return fail('The character file could not be made.');
  return answer.ok === true ? answer : fail(String(answer.message || 'The character file could not be made.'));
}
