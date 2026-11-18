// The Tools page's handle on the engine: what the next reply is sent, the problems, the Inspector's replies, the report, and the rebuild and save points (the reader's own buttons; nothing else here writes).
import { promptSize, sentText, redactSentOf } from '../../core/sent/sent.js';
import { DEFAULT_TAIL_BUDGET } from '../../core/prompt.js';
import { CORE_FEATURE } from '../../core/features.js';

const NONE = { ok: false, code: 'FAILED', message: 'Save points are not available.' };
const settled = (run, fallback) => { try { return run() ?? fallback; } catch { return fallback; } };

/**
 * Builds the handle from the runtime and a getter for the page host (it is made after the handle). Every method reads the live engine each time it is called:
 * `sent()` → { parts: { size, text, budget } } or null (no chat), `problems()` → the turn's list, `blocked()`, `rebuild(module, read)`,
 * `replies()`, `reply(index)`, `report()` → a promise of the text, `savePoints()` → { on, here, points } (on = the feature's switch), `makeSavePoint(name)`, `returnToSavePoint(id)`, `forgetSavePoint(id)` → the save points' answer ({ ok, … } or a failure).
 */
export function createToolsHandle({ runtime, ui, savePoints = () => null }) {
  const registry = runtime.registry;
  const names = id => (id === 'story-suite' ? 'Story Suite' : registry?.module?.(id)?.name ?? id);
  const inspector = () => ui()?.inspector ?? null;
  return Object.freeze({
    sent() {
      const turn = runtime.turn;
      const got = settled(() => (typeof turn?.previewFit === 'function' ? turn.previewFit() : turn?.preview?.()), null);
      const parts = Array.isArray(got) ? got : got?.parts;
      if (!Array.isArray(parts)) return null;
      const own = Array.isArray(got?.own) ? got.own : [];
      const stored = runtime.settings?.()?.tailBudget;
      const budget = Number.isInteger(got?.fit?.budget) ? got.fit.budget : Number.isInteger(stored) && stored > 0 ? stored : DEFAULT_TAIL_BUDGET;
      const size = promptSize(parts, { names, budget, own });
      return { size, budget, text: sentText(parts, own, { names, redact: redactSentOf(registry) }).copy };
    },
    problems: () => settled(() => runtime.turn?.problems?.(), []),
    blocked: () => settled(() => runtime.timeline?.blocked?.(), null),
    nameOf: names,
    rebuild: (module, read) => runtime.timeline.host.rebuild(module, { read }),
    replies: () => settled(() => inspector()?.replies(), []),
    reply: index => settled(() => inspector()?.reply(index), null),
    savePoints() {
      const points = savePoints();
      if (!points) return { on: false, here: '', points: [] };
      const on = registry?.feature?.(CORE_FEATURE.savepoints) ? registry.featureOn(CORE_FEATURE.savepoints) === true : true;
      return { on, here: settled(() => points.chatId?.(), ''), points: on ? settled(() => points.list(), []) : [] };
    },
    makeSavePoint: name => savePoints()?.save({ name }) ?? Promise.resolve(NONE),
    returnToSavePoint: id => savePoints()?.returnTo(id) ?? Promise.resolve(NONE),
    forgetSavePoint: id => savePoints()?.forget(id) ?? Promise.resolve(NONE),
    /** The settings now in force as a game pack: `{ ok, pack, text, sections }` or `{ ok: false, message }`. */
    exportGamePack: async name => {
      if (!runtime.cardSettings) return { ok: false, message: 'Settings are not available.' };
      // (rare: the builder, the pack checker and the sections' code are fetched now, not at the page start)
      const [{ buildGamePack }] = await Promise.all([import('../../packs/game-export.js'), runtime.cardSettings.loadSections?.()]);
      return buildGamePack(runtime.cardSettings, { name });
    },
    report: () => (typeof ui()?.diagnostics?.report === 'function' ? ui().diagnostics.report() : Promise.resolve('')),
  });
}
