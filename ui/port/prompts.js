// The Tools page's Prompts commands for the port: a prompt's new text, or its built-in one again, stored in the setting the engine reads.
import { PROMPTS } from '../select/prompts.js';

const FAILED = { ok: false, code: 'FAILED' };
const KEYS = ['tools.prompt.save', 'tools.prompt.reset'];

// What is stored for `text`: cut at the prompt's limit; the planner stores '' for its default (blank or the default itself), as its old editor did.
function storedFor(spec, text) {
  const value = String(text ?? '').slice(0, spec.max);
  if (spec.blank === '' && (!value.trim() || value === spec.fallback)) return '';
  return value;
}

/**
 * `settings.action` with key `tools.prompt.save` and value { id, text } stores that prompt's text; `tools.prompt.reset` with value { id } stores its
 * built-in text (People) or '' (the planner). → { ok: true, value } (what was stored) or a failure. Any other command is not ours: null.
 */
export function promptsCommand(type, payload, writes) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.action' || !KEYS.includes(key)) return null;
  const spec = PROMPTS.find(p => p.id === payload?.value?.id);
  if (!spec) return { ...FAILED, message: 'That prompt is not on this page.' };
  const value = key === 'tools.prompt.reset' ? spec.blank : storedFor(spec, payload.value.text);
  const done = writes?.settings?.set?.(spec.module, spec.field, value);
  return done === undefined ? { ...FAILED, message: 'The prompt was not saved.' } : { ok: true, value: done };
}
