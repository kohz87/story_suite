// Keeps the board's fixed grammar as small as a quiet reply's grammar.
// Combat flavour and the foe kinds the story may still write are supplied only in the reply context that can use them.
import { activeDefinition } from '../../data-modules/adapters.js';
import { moduleGrammar, referenceOf } from '../../data-modules/grammar.js';
import { oneLine } from '../../../core/text.js';

// How a fight starts under the board: the story sets a foe slot, the offer line appears, and code plays the blows.
const START = 'A fight starts when you set a foe slot; the reader plays it on the board, so tell no blows yourself.';

// Foes stand but this reply carries no board play (the reader typed past the fight offer): the story goes on and no blow is told in prose.
const STANDING = 'The foes set stand, but this reply plays no fight: a message that is not played on the board moves the story on. '
    + 'The foes may press, block or follow; resolve no exchange, roll no check for a blow, and tell no wound, HP or other change of state.';

// After the carried fight has ended (won / fled / lost): a group that arrives later is a new fight on the board.
const START_AFTER = 'If a new group arrives after this fight, set a foe slot; a new fight starts on the board, so tell no blows.';

export { boardGrammar, boardXpGuide } from '../../data-modules/board-static.js';

// The sections of a Combat rules text the board owns (a line starting "Label:"): the board plays every exchange and rolls every blow, so a
// story told under the board never gets them (narrated combat is gone: Standard + fight board only). The XP guide is in the fixed grammar.
const BOARD_OWNED = new Set(['exchanges', 'rolls', 'xp guide']);
const sectionOf = line => /^\s*([A-Za-z][A-Za-z &]{0,30}):/u.exec(line)?.[1].trim().toLowerCase() ?? '';
const flavourOf = prompt => String(prompt ?? '').split('\n').filter(line => !BOARD_OWNED.has(sectionOf(line))).join('\n').trim();

// The foe kinds the story may still write beside a carried fight: only the clears (a group fled, yielded or went away); after an ended
// fight also the set-slot kinds, so a new group that arrives later in the reply opens as foes. The narrator never hurts a foe.
const CLEAR_ONLY = /^clear-\d+$/u;
const NEW_GROUPS = /^(?:set-slot|clear)-\d+$/u;

function foeKindLines(state, only) {
    const ids = Object.keys(state?.domains?.dataModules?.active ?? {});
    return ids.flatMap(id => {
        const definition = activeDefinition(state, id);
        if (definition?.role !== 'foes') return [];
        const lines = moduleGrammar(definition, referenceOf(ids, id), { prompt: false, only });
        return lines ? [lines] : [];
    });
}

/**
 * The reply's board lines. `fight`: a foe stands or a carried fight ended in this reply; `ended`: it ended (won, fled, lost); `played`: the board
 * settled a segment of it in this reply (the narrator tells the board's note). A fight that stands unplayed gets no Combat rules text at all, only
 * the start line and the line that the story goes on; a played one gets the rules' flavour without the board-owned sections.
 */
export function boardReplyGrammar(state, { fight = false, ended = false, played = ended } = {}) {
    const ids = Object.keys(state?.domains?.dataModules?.active ?? {});
    const hasFoes = ids.some(id => activeDefinition(state, id)?.role === 'foes');
    const lines = ids.flatMap(id => {
        const definition = activeDefinition(state, id);
        if (!definition || !fight) return [];
        const prompt = definition.role === 'rules' && played ? flavourOf(definition.prompt) : definition.role === 'foes' ? String(definition.prompt ?? '').trim() : '';
        return prompt ? [oneLine(prompt)] : [];
    });
    if (!fight) { if (hasFoes) lines.push(START); return lines; }
    lines.push(...foeKindLines(state, ended ? NEW_GROUPS : CLEAR_ONLY));
    if (!played) lines.push(START, STANDING);
    else if (ended && hasFoes) lines.push(START_AFTER);
    return lines;
}
