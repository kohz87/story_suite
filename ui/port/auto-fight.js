// The fight board's Auto: it plays up to "Most exchanges Auto plays" (Settings › RPG; 9 = until the end), stopping early on a win, a loss, a badly hurt hero or a reply that holds all the fight it can save, like the offer's Auto-fight.
import { autoCapFrom, autoExchanges } from '../../modules/rpg/names.js';
import { runAuto } from '../../modules/rpg/board/auto-run.js';

/** `payload` = { id, stance? } (the switch as left for the first exchange); `values` = Story Block's settings. → the answer the single-step Auto gives: { ok, staged, stop, ...current } or { ok: false, message }. */
export function autoCapped(api, payload, values) {
  const ran = runAuto({ api, cap: autoExchanges(autoCapFrom(values)), held: payload?.stance, id: payload?.id });
  if (ran.stop === 'error' && ran.done === 0) return { ok: false, message: String(ran.error || 'The fight could not be played.') };
  if (ran.stop === 'none' && ran.done === 0) return { ok: false, message: 'Auto found nothing to do.' };
  if (ran.stop === 'full' && ran.done === 0) return { ok: false, message: String(ran.error || 'The fight holds all one reply can save. Send to go on.') };
  const current = api.current?.();
  return { ok: true, staged: ran.done, stop: ran.stop, ...(current ?? {}) };
}
