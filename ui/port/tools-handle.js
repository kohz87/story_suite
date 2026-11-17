// The Tools page's read-only handle on the engine: what the next reply is sent, the problems, the Inspector's replies, the rebuild and the report.
import { promptSize, sentText, redactSentOf } from '../legacy/host-ui.js';
import { DEFAULT_TAIL_BUDGET } from '../../core/prompt.js';

const settled = (run, fallback) => { try { return run() ?? fallback; } catch { return fallback; } };

/**
 * Builds the handle from the runtime and a getter for the page host (it is made after the handle). Every method reads the live engine each time it is called:
 * `sent()` → { parts: { size, text, budget } } or null (no chat), `problems()` → the turn's list, `blocked()`, `rebuild(module, read)`,
 * `replies()`, `reply(index)`, `report()` → a promise of the text. Nothing here writes except `rebuild`, the reader's own button.
 */
export function createToolsHandle({ runtime, ui }) {
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
    report: () => (typeof ui()?.diagnostics?.report === 'function' ? ui().diagnostics.report() : Promise.resolve('')),
  });
}
