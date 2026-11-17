// The new view's command names that the engine registers under another name or as one dm.set: Quiet scene, End this arc and Spend points.

import { actorIdOf } from '../../modules/rpg/roster-parts/actor-id.js';

const NO = (message) => ({ ok: false, code: 'FAILED', message });
const RENAMED = Object.freeze({ 'pulse.quiet': 'director.pulse.quiet', 'arc.end': 'director.arc.end' });

/** The names `aliasCommand` answers (the port's `can` counts them). */
export const ALIAS_NAMES = Object.freeze([...Object.keys(RENAMED), 'rpg.stats.spend']);

// The member's Character block row of dataModules.setup, found by the actor id the sheet gives it.
function blockOf(sdk, member) {
  const rows = sdk?.query?.('dataModules.setup', {});
  return (Array.isArray(rows) ? rows : []).find((row) => row?.pinned === true && row.pinnedDefinition?.role === 'character' && actorIdOf(row.module) === member) ?? null;
}

// The same one `dm.set` the old Spend points sheet sends (modules/rpg/view/distribute.js save): the raised stats and the points left, all or nothing.
async function spend(sdk, payload) {
  const rows = sdk?.query?.('rpg.sheet', {});
  const sheet = (Array.isArray(rows) ? rows : []).find((row) => row?.id === payload?.member);
  const block = blockOf(sdk, payload?.member);
  if (!sheet || !block || !sheet.stats) return NO('That character has no points to spend.');
  const fields = {};
  let spent = 0;
  for (const [key, value] of Object.entries(payload?.stats ?? {})) {
    const was = sheet.stats[key];
    if (!Number.isInteger(value) || !Number.isInteger(was)) return NO('That is not a stat.');
    if (value < was) return NO('Points cannot be taken back.');
    if (value > was) { fields[key.toLowerCase()] = value; spent += value - was; }
  }
  if (spent === 0) return { ok: true };
  if (spent > (sheet.points ?? 0)) return NO('There are not that many points to spend.');
  fields.points = sheet.points - spent;
  const subject = block.pinnedDefinition.scope === 'chat' ? null : block.subjects?.[0];
  return sdk.command('dm.set', { module: block.module, fields, ...(subject ? { who: subject } : {}) });
}

/** The alias answer for `type`, or null when it is not one of ours. Quiet scene and End this arc are the Director's own commands under their registered names. */
export async function aliasCommand(sdk, type, payload) {
  if (!ALIAS_NAMES.includes(type)) return null;
  if (typeof sdk?.command !== 'function') return NO('The engine has no command.');
  if (type === 'rpg.stats.spend') return spend(sdk, payload);
  return sdk.command(RENAMED[type], payload ?? {});
}
