// The Models page's two commands for the port: storing a role's connection and the one tiny test call.

import { ROLE_SETTING } from '../../core/model-call/connection-for.js';

const TEST_MS = 20000;
const roleOf = key => String(key ?? '').split('.')[1];

/**
 * `settings.set` with key `models.<role>` stores the role's profile name (Story has none); `settings.action` with key `models.test` and
 * `value` = the role makes one tiny call on that role's connection → { ok: true, seconds } or { ok: false, message }.
 * Any other command is not the Models page's: returns null.
 */
export async function modelsCommand(sdk, type, payload, now = Date.now) {
  const key = String(payload?.key ?? '');
  if (type === 'settings.set' && key.startsWith('models.')) {
    const role = roleOf(key);
    if (!Object.hasOwn(ROLE_SETTING, role)) return { ok: false, code: 'FAILED', message: 'That connection cannot be changed here.' };
    const stored = sdk?.settings?.set?.(null, ROLE_SETTING[role], payload.value);
    return stored === undefined ? { ok: false, code: 'FAILED', message: 'That connection was not saved.' } : { ok: true, value: stored };
  }
  if (type === 'settings.action' && key === 'models.test') {
    const role = String(payload?.value ?? '');
    if (typeof sdk?.callModel !== 'function') return { ok: false, message: 'The engine cannot make a call.' };
    const started = now();
    const answer = await sdk.callModel({ role, prompt: 'Reply with the single word: ok', maxTokens: 8, module: 'models-test', timeoutMs: TEST_MS });
    return answer?.ok ? { ok: true, seconds: Math.max(0.1, Math.round((now() - started) / 100) / 10) } : { ok: false, message: String(answer?.message || 'no answer came back') };
  }
  return null;
}
