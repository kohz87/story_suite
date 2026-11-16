// Story Suite v2: builds the static and tail texts for the next reply, with their parts and the context fit.

import { receiptCue } from '../lean-rpg/cue.js';
import { settleCue, SETTLE_TYPE } from '../interaction/note.js';
import { HAPPENED } from './markers.js';
import { DEFAULT_TAIL_BUDGET, KEPT_TAIL_LINES, KEPT_TAIL_TOKENS } from './tail-budget.js';
import { estimateTokens, attempt } from './shared-helpers.js';
import { tailOrder } from './tail-order.js';
import { staticParts } from './static.js';
import { contextFit } from './context-fit.js';
import { fit, dropLast, happenedLines } from './trim.js';

const linesOf = value => (Array.isArray(value) ? value : [])
    .filter(line => typeof line === 'string')
    .map(line => line.trimEnd())
    .filter(line => line.trim());

// A prelude cue is written as its own [Happened] note. It joins the leading note, so a reply
// never sees two [Happened] markers when an older receipt is still untold.
const happenedCue = text => {
    const match = /^\s*\[Happened\](?:\r?\n([\s\S]*))?$/u.exec(String(text ?? ''));
    const body = match?.[1]?.trim();
    return match && body ? body : null;
};

/**
 * Builds both texts for the next reply.
 * - `registry`: createRegistry() result; `view`: { state, query, settings, chat } (§6).
 * - `untold`: receipts to tell (oldest first); only those with narrate !== false and a summary. A receipt whose `data.told` is
 *   a text has it told after its summary in brackets (what the narrator must not read into the line; the reader's card does not show it).
 * - `settings`: the host settings ({ tailBudget } in tokens, default 1500; { contextShare } percent, 40).
 * - `context` (optional): { size, reply, room } of the reader's context (contextFit); the tail is cut so
 *   static + tail fit the share, the static part never is.
 * - `cues` (optional): { [moduleId]: string[] } extra required tail lines (beforeGenerate hooks).
 * - `substitute` (optional): text → text, run on every text before it is counted (turn.js fills in
 *   `{{user}}` and `{{char}}` with it).
 * - `ownTokens` (optional): what modules send on their own this reply (contextFit), 0 by default.
 * - `keptTokens` (optional): the tokens the kept prelude cues already took of KEPT_TAIL_TOKENS; a module's own tail lines given as
 *   `{ text, keep: true }` are kept while the rest of that cap and KEPT_TAIL_LINES allow, in tail order; any more are ordinary lines.
 * - `rolled` (optional): the reply has automatic rolls (an old planner record or the fight board rolled some), told to the static parts as `hint.rolled`.
 * Returns { staticText, tailText, parts: [{ module, label, place, text, tokens, dropped? }],
 * problems, fit (contextFit, or null) }. `parts` is what the What's-sent preview lists, in prompt order.
 */
export function assemble({ registry, view, untold = [], settings = {}, cues = {}, substitute = null, context = null, ownTokens = 0, rolled = false, keptTokens = 0 }) {
    const problems = [];
    const fill = typeof substitute === 'function' ? text => String(substitute(text) ?? '') : text => text;
    const statics = staticParts(registry, problems, { view, rolled: rolled === true }).map(part => ({ ...part, text: fill(part.text) }));
    const staticText = statics.map(part => part.text).join('\n\n');
    const fitted = contextFit(context, estimateTokens(staticText), settings, ownTokens);
    const total = fitted ? fitted.budget
        : Number.isInteger(settings?.tailBudget) && settings.tailBudget > 0 ? settings.tailBudget : DEFAULT_TAIL_BUDGET;

    const happened = untold
        .map(receipt => receipt && receipt.narrate !== false && typeof receipt.summary === 'string' ? { receipt, text: receipt.type === SETTLE_TYPE ? settleCue(receipt) : receiptCue(receipt) } : null)
        .filter(entry => entry && entry.text.trim())
        .map(({ receipt, text }) => fill(`${text}${typeof receipt.data?.told === 'string' && receipt.data.told.trim() ? ` (${receipt.data.told.trim()})` : ''}`)
            .trim().split(/\n/).map(part => part.trim()).filter(Boolean).join(' '));
    const cueHappened = [];

    const sections = [];
    for (const context of tailOrder(registry.contexts())) {
        // A cue may be `{ text, keep: true }`: kept whole, whatever the budget says (the rolls the narrator must tell). One marked `interaction: true` (a settled
        // interaction's note; `board: true` is the fight board's own, until it moves onto the port) also joins the leading note; the RPG's ordinary roll cues stay in their section.
        const given = Array.isArray(cues?.[context.moduleId]) ? cues[context.moduleId] : [];
        const ordinary = [];
        const pinned = new Set();
        for (const cue of given) {
            const text = typeof cue?.text === 'string' ? cue.text : typeof cue === 'string' ? cue : '';
            if (!text.trim()) continue;
            const body = cue?.keep === true && (cue.interaction === true || cue.board === true) ? happenedCue(text) : null;
            if (body !== null) {
                cueHappened.push(fill(body));
                continue;
            }
            ordinary.push(fill(text));
            if (cue?.keep === true) pinned.add(fill(text).trimEnd());
        }
        const extra = linesOf(ordinary);
        let tail = null;
        if (typeof context.tail === 'function') tail = attempt(() => context.tail(view), null, problems, `${context.name}: this reply`);
        let keptHere = 0;
        const own = (Array.isArray(tail?.lines) ? tail.lines : []).map(line => {
            if (typeof line === 'string') return line;
            if (typeof line?.text !== 'string') return null;
            const text = fill(line.text).trimEnd();
            const size = estimateTokens(text);
            if (line.keep !== true || !text.trim() || keptHere >= KEPT_TAIL_LINES || keptTokens + size > KEPT_TAIL_TOKENS) return line.text;
            keptHere += 1; keptTokens += size; pinned.add(text);
            return text;
        });
        const section = { context, lines: linesOf([...extra, ...own].map(fill)), optional: linesOf(linesOf(tail?.optional).map(fill)), pinned, dropped: 0 };
        if (!section.lines.length && !section.optional.length) continue;
        if (context.budget) section.dropped += fit(section, context.budget);
        sections.push(section);
    }

    const told = happened.length ? happenedLines(happened, Math.floor(total / 2)) : cueHappened.length ? [HAPPENED] : [];
    const head = told.length
        ? { module: 'story-suite', label: 'Happened', text: [...told, ...cueHappened].join('\n') }
        : null;

    // The host's total: what the sections may spend after [Happened] (and the line breaks).
    const tailText = () => [head?.text, ...sections.map(section => [...section.lines, ...section.optional].join('\n'))]
        .filter(Boolean).join('\n');
    for (const pass of ['optional', 'lines']) {
        for (let i = sections.length - 1; i >= 0 && estimateTokens(tailText()) > total; i -= 1) {
            const list = sections[i][pass];
            while (list.length && estimateTokens(tailText()) > total) {
                if (pass === 'optional') list.pop(); else if (!dropLast(sections[i], list)) break;
                sections[i].dropped += 1;
            }
        }
    }

    const tailParts = [
        ...(head ? [{ ...head, place: 'tail' }] : []),
        ...sections
            .map(section => ({
                module: section.context.moduleId,
                label: `${section.context.name}: this reply`,
                place: 'tail',
                text: [...section.lines, ...section.optional].join('\n'),
                dropped: section.dropped,
            }))
            .filter(part => part.text || part.dropped),
    ];
    const parts = [...statics, ...tailParts].map(part => ({ ...part, tokens: estimateTokens(part.text) }));
    return { staticText, tailText: tailText(), parts, problems, fit: fitted };
}
