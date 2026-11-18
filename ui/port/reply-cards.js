// Asks every module's card (registry.cardEntries) about the head reply and hands the view what answers: the cards under replies.

import { mountQuery } from '../../core/sdk.js';
import { CORE_FEATURE } from '../../core/features.js';

/**
 * Builds the view's handle on the cards under replies from the engine's `registry`, `store` and `initial()` (the state of a chat with no
 * record yet, so a greeting-only chat is asked too) and SillyTavern's `ctx()`. `head()` → { index, cards: [{ key, card }] } or null.
 * Each card's `for(state, message, { index, head: true, chatId, query })` is asked once per call on the head reply's state, so a card is
 * a pure function of the story there: what the reader answered on it is in that reply's receipts and comes back with a swipe back, a
 * reload or a rebuild, and goes with a delete. A card that throws is left out and never stops the others; raw cards (the module's own
 * words) are read by the view (ui/select/reply-card.js). Null while the Cards under replies switch is off or no module has a card.
 */
export function createCardSource({ registry, store, initial = null, ctx = () => null }) {
  const runAt = mountQuery(registry, () => store.receipts?.() ?? []);
  const chatId = () => { try { const c = ctx(); return String(c?.getCurrentChatId?.() ?? c?.chatId ?? ''); } catch { return ''; } };
  return Object.freeze({
    head() {
      try {
        if (registry.feature?.(CORE_FEATURE.cards) && registry.featureOn(CORE_FEATURE.cards) !== true) return null;
        const entries = (registry.cardEntries?.() ?? []).filter(entry => typeof entry?.fn === 'function');
        const index = store.headIndex();
        if (!entries.length || !Number.isInteger(index) || index < 0) return null;
        const state = store.head() ?? (typeof initial === 'function' ? initial() : null);
        if (!state) return null;
        const message = ctx()?.chat?.[index] ?? null;
        const query = (name, args) => (registry.query?.(name) ? runAt(name, args, state) : null);
        const own = { index, head: true, chatId: chatId(), query };
        const cards = [];
        for (const { id, fn } of entries) {
          try {
            const card = fn(state, message, own);
            if (card && typeof card === 'object') cards.push({ key: id, card });
          } catch { /* one module's card never stops the others */ }
        }
        return { index, cards };
      } catch {
        return null;
      }
    },
  });
}
