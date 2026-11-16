// Story Suite v2: the prelude loop of the cues: each requested prelude command is previewed on the state the earlier cues leave,
// its receipt told to the narrator (or kept, or hidden), and the board's checks run first. A settled interaction's note is its
// receipt's `summary`, pinned by the receipt type (never by `data.keep`) and named only when over its allowance.
// `runPreludes` fills the caller's `cues` and `prechecks`; it never imports turn.js.

import { estimateTokens, KEPT_TAIL_TOKENS } from '../prompt.js';
import { DICE as RPG_DICE, RESOLVE as RPG_RESOLVE } from '../../modules/rpg/names.js';
import { receiptCue } from '../../modules/rpg/cue.js';
import { noteLong } from '../interaction/note.js';
import { kindName } from '../interaction/kind-name.js';
import { boardFailure, boardStartState } from './held-board.js';

const SETTLE = 'interaction.settle';

// A prelude cue a module marks kept (receipt `data.keep === true`) is pinned too, up to this many tokens in all per reply; the rest are plain cues.
export const KEPT_PRELUDE_TOKENS = KEPT_TAIL_TOKENS;

export function runPreludes({ s, bus, store, problem, kindOf = null }, { requested, cues, prechecks, previewState }) {
    let boardStop = null;
let keptPrelude = 0;
    for (const { moduleId, type: preludeType, payload, seed } of requested) {
        if (preludeType === RPG_RESOLVE && payload?.board?.setup?.opening) {
            const checked = boardStartState(bus, store.head(), payload.board);
            if (checked.error) return { blocked: { moduleId, reason: checked.error } };
        }
        const prior = s.session?.prechecks?.find(step => step.type === preludeType && JSON.stringify(step.payload) === JSON.stringify(payload));
        const result = bus.run(preludeType, payload, { cause: 'system', ...(previewState ? { state: previewState } : {}), ...(prior || seed !== undefined ? { seed: prior?.seed ?? seed } : {}) });
        if (result?.ok) {
            // The RPG's rolls move bars (hits, heals, skill costs): the tail's block lines are read from the state they leave, so they say what the cue says.
            // (An interaction's opening and segment chain the same way: the segment is previewed on the state its opening leaves.)
            if ((preludeType === RPG_RESOLVE || preludeType === SETTLE) && result.state) previewState = result.state;
            // How the carried board fight ended (won / fled / lost / open): the tail reads it to allow a new foe group only after an ended fight.
            if (preludeType === RPG_RESOLVE && payload?.board) boardStop = result.receipt?.data?.v2?.result?.stop ?? null;
            prechecks.push({ type: preludeType, payload, seed: result.receipt.seed });
            // The reply's story-check dice: told as the tail note itself (kept whole, no [Happened] marker), drawn from the receipt's recorded dice.
            if (preludeType === RPG_DICE) { cues[moduleId] = [...(cues[moduleId] ?? []), { text: receiptCue(result.receipt), keep: true }]; continue; }
            // A prelude that says it is not for the narrator (`narrate: false`, the RPG's no-rolls note) is stored with the reply and told to no one.
            if (result.receipt.narrate === false) continue;
            const told = `[Happened]\n${preludeType === SETTLE ? String(result.receipt.summary ?? '') : receiptCue(result.receipt)}`;
            // A settled interaction's note is pinned by its receipt type, outside the pool below (interaction/note.js): never cut, only named when long.
            // A note with no text tells nothing: no bare [Happened] header is pinned.
            if (preludeType === SETTLE) {
                if (!String(result.receipt.summary ?? '').trim()) continue;
                const kind = kindOf?.(payload?.kindId);
                const long = noteLong(result.receipt.summary, kind, kindName(kind, payload?.kindId));
                if (long) problem({ module: moduleId, ...long });
                cues[moduleId] = [...(cues[moduleId] ?? []), { text: told, keep: true, interaction: true }];
                continue;
            }
            // A module may mark its prelude cue kept (`receipt.data.keep === true`): pinned like the RPG's, but only while the pinned
            // prelude text of the reply stays within KEPT_PRELUDE_TOKENS in all, so pinning can never starve the rest of the tail.
            let pin = false;
            if (preludeType !== RPG_RESOLVE && result.receipt.data?.keep === true) {
                const size = estimateTokens(told);
                if (keptPrelude + size <= KEPT_PRELUDE_TOKENS) { keptPrelude += size; pin = true; }
            }
            cues[moduleId] = [...(cues[moduleId] ?? []), preludeType === RPG_RESOLVE ? { text: told, keep: true, ...(payload?.board ? { board: true } : {}) } : pin ? { text: told, keep: true } : told];
        } else if (preludeType === RPG_RESOLVE && payload?.board) {
            const reason = boardFailure('The fight could not be prepared:', result?.message);
            problem({ module: moduleId, code: result?.code ?? 'FAILED', message: reason });
            return { blocked: { moduleId, reason } };
        } else if (preludeType === SETTLE) {
            // An interaction that cannot be settled (what it read changed) holds the send with the reason; nothing goes out without it.
            const reason = result?.message ?? 'The interaction could not be prepared.';
            problem({ module: moduleId, code: result?.code ?? 'FAILED', message: reason });
            return { blocked: { moduleId, reason } };
        } else problem({ module: moduleId, code: result?.code ?? 'FAILED', message: `The cue "${preludeType}" was not prepared: ${result?.message ?? 'unknown error'}` });
    }
    return { previewState, boardStop, keptPrelude };
}
