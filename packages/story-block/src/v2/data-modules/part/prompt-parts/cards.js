// Derives the cards shown under the head reply from the active blocks and fills the reply-cards slots.
import { activeDefinition, instanceOf } from '../../adapters.js';
import { createEvaluation } from '../../interpreter.js';
import { oneLine } from '../../../../text.js';
import { kept } from '../shared.js';

// --- Cards under the head reply -------------------------------------------------------------------------------------------------
// A block's `cards` are derived from the head reply's state each time the cards are asked for, never stored. They reach the reply-cards
// socket (src/v2/reply-cards.js) through a few fixed slots, because that socket takes one named card per entry: slot n answers with the
// nth card of the active blocks, in pin order and, within a block, in the order written. A card with a button runs that Button of the
// same block as a reader command on the latest reply.
export const CARD_SLOTS = 8;
const CARD_LOOK = Object.freeze({ info: { tone: 'info', icon: 'ph-info' }, warn: { tone: 'accent', icon: 'ph-warning' }, end: { tone: 'bad', icon: 'ph-skull' } });
const cardLists = new WeakMap();

const CARD_RANK = Object.freeze({ end: 1, warn: 2, info: 3 });

/**
 * The cards the head state shows: [{ module, card }] with card in reply-cards.js's shape. A card whose condition cannot be asked is left out.
 * They are ordered the end cards of a role `character` block first (the death notice), then any other end card, then warn, then info (pin
 * order, then written order, within each) before the slots are filled, so a death notice always has a slot, however many other cards show.
 */
export function blockCards(state) {
    const active = state?.domains?.dataModules?.active;
    if (!active || !Object.keys(active).length) return [];
    return kept(cardLists, state, () => Object.keys(active).flatMap(module => {
        const definition = activeDefinition(state, module), instance = instanceOf(state, module);
        if (!definition?.cards?.length || !instance) return [];
        return definition.cards.flatMap((entry, at) => {
            try {
                if (!createEvaluation(definition, instance).condition(['card', at], entry.when, {})) return [];
            } catch { return []; }
            const look = CARD_LOOK[entry.tone] ?? CARD_LOOK.info, kind = entry.button ? definition.kinds[entry.button] : null;
            return [{ module, rank: entry.tone === 'end' && definition.role === 'character' ? 0 : CARD_RANK[entry.tone] ?? CARD_RANK.info, card: { ...look, title: entry.title, text: entry.text,
                actions: kind ? [{ id: entry.button, label: oneLine(kind.title ?? entry.button.replace(/^button-/, '')), primary: true,
                    command: 'dm.act', payload: { module, kind: entry.button } }] : [] } }];
        });
    }).sort((a, b) => a.rank - b.rank).map(({ module, card }) => ({ module, card })));
};
const blockCardSlots = Object.fromEntries(Array.from({ length: CARD_SLOTS }, (_, at) => [`block-card-${at + 1}`, { for: state => blockCards(state)[at]?.card ?? null }]));

export { blockCardSlots };
