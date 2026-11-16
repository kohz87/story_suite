// Story Suite v2: the change lines that come after a reply, moved out of createEvents unchanged: lines found late (an afterReply hook's) captured on the
// reply and kept in a hidden block, and the Assist safety net's lines (now, or kept for the next reply). `createLateEvents(s, deps)` is given the turn's
// state holder `s` and the turn parts it uses; it never imports turn.js.
import { extractBlock, hideBlock, markOff, parseChanges, withAssist } from '../capture.js';
import { readRecord } from '../persist.js';
import { notWritten } from '../assist/extractor.js';
import { heldWhy, refusedWhy, waitForBarrier } from '../assist/safety.js';
import { assistPresentGuard } from '../assist/where.js';
import { ruleMarksOf } from './rule-marks.js';

export function createLateEvents(s, deps) {
    const { ctx, isCarrier, store, problem, changeHeads, readBlock, lateLines, captureLines, withCaps, trySave, saveText, redraw, events, registry, bus } = deps;

    /** Change lines found after the reply (afterReply): captured on it and kept in its hidden block. */
    async function captureLate({ index, swipe, sid, message: from } = {}, text = '', { assist = false, refused = [], placeLines = [] } = {}) {
        const message = ctx?.chat?.[index];
        if (assist) return captureAssist({ index, swipe, sid, from }, text, message, refused, placeLines);
        if (!isCarrier(message) || store.headIndex() !== index || (Number.isInteger(message.swipe_id) ? message.swipe_id : 0) !== swipe || s.session) {
            return { receipts: [], problems: ['The reply changed before its late change lines arrived; they were not used.'] };
        }
        const parsed = readBlock(index, String(text ?? ''));
        const problems = [...parsed.problems];
        const result = await captureLines(index, parsed.lines, String(message.mes ?? ''), 'late');
        problems.push(...result.problems);
        if (parsed.lines.length) {
            // Kept in a hidden block of their own after the reply's, so Re-read finds them too (and what the
            // reply's comment holds besides its block, the lines left in the story, stays as it was).
            const base = String(message.mes ?? '');
            const from = base.trimEnd().length;
            const mes = withCaps(markOff(hideBlock(`${base}\n\n<Changes>\n${parsed.lines.map(line => line.raw).join('\n')}\n</Changes>`, 'Changes', { from }), result.off, from), from);
            message.mes = mes;
            if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id)) message.swipes[message.swipe_id] = mes;
        }
        if (store.dirty()) {
            if (store.saveIdle?.() !== true) await trySave('after the late change lines');
        } else if (parsed.lines.length) await saveText();
        if (parsed.lines.length) redraw(index, message);
        const turn = { index, type: 'late', receipts: result.receipts, steps: result.steps, problems, told: [] };
        events?.emit('turn', turn);
        return turn;
    }

    /**
     * The Assist safety net's lines for reply `index` (MODULES §F123). Still the head on the same swipe, no send begun: run now
     * (`assist: 'now'`, after the reply's own) and kept in its <Changes-assist> section. A send already begun: kept as
     * <Changes-assist-next> through the stricter wall, for the next reply to apply; nothing changes now. Else (swiped, deleted): not used.
     */
    async function captureAssist({ index, swipe, sid, from }, text, message, refused = [], placeLines = []) {
        // The same reply the answer was asked for (its record ID, else the message itself): an index and swipe are reused by a replacement.
        const same = () => isCarrier(message) && store.headIndex() === index && (Number.isInteger(message.swipe_id) ? message.swipe_id : 0) === swipe
            && (sid ? store.carrierSid?.(index) === sid : !from || message === from);
        const drop = () => (problem({ code: 'REPLY_CHANGED', quiet: true, message: `The safety net's answer for reply ${index} arrived after that reply was changed or replaced; its lines were not used.` }),
            { receipts: [], problems: ['The reply changed before the safety net\'s lines arrived; they were not used.'], dropped: true });
        if (!same()) return drop();
        const refusals = (Array.isArray(refused) ? refused : []).filter(item => typeof item?.line === 'string' && item.line)
            .map(item => problem({ index, line: item.line, code: 'REFUSED', message: `"${item.line}" was not used: ${String(item.why ?? '').slice(0, 240)}.` }));
        // Held only by the timeline's momentary barrier (a native change finishing): waited for, briefly, then the reply is looked at again.
        await waitForBarrier(registry, parseChanges(String(text ?? '')).lines, same);
        if (!same()) return drop();
        const mes = String(message.mes ?? ''), record = readRecord(message), marks = ruleMarksOf(record?.rules);
        const block = extractBlock(mes, 'Changes', null, { heads: changeHeads() });
        // Read as the reply was captured (its caretWords mark): a preset's ^ block gives the same lines live and on Re-read.
        const blockLines = block === null ? [] : parseChanges(block, { caret: marks.includes('caretWords') }).lines.map(line => line.raw);
        const own = [...blockLines, ...lateLines(index, []).map(line => line.raw)];
        const parsed = parseChanges(String(text ?? '')).lines;
        const fresh = new Set(notWritten(parsed.map(line => line.raw), own, { scene: blockLines }));
        // Refuse held modules before the late wall, so even a + line arriving during a send gets a visible reason, and before any hook runs.
        let kept = parsed.filter(line => {
            const held = fresh.has(line.raw) ? heldWhy(registry, line) : null;
            if (held) refusals.push(problem({ module: held.module, index, line: line.raw, code: 'MODULE_HELD', assist: 'now', message: held.message }));
            return fresh.has(line.raw) && !held && !refusedWhy(line, null, { late: Boolean(s.session || s.replyBusy) });
        });
        if (marks.includes('assistPresent')) {   // arrivals judged against the end of the reply (only replies that carry the mark)
            const guarded = assistPresentGuard({ lines: kept, places: parseChanges((placeLines.length ? placeLines : parsed.filter(line => line.kind === 'place').map(line => line.raw)).join('\n')).lines, text: mes, heads: changeHeads(), own: parseChanges(blockLines.join('\n')).lines, state: store.head(), marks, registry, bus, index, sid: record?.sid, receipts: record?.receipts ?? [] });
            kept = guarded.lines; refusals.push(...guarded.refused.map(item => problem({ index, line: item.line, code: 'REFUSED', message: `"${item.line}" was not used: ${item.why}.` })));
        }
        const tellRefusals = () => { if (refusals.length) events?.emit('turn', { index, type: 'late', receipts: [], steps: [], problems: refusals, told: [] }); };
        const store1 = mes2 => { message.mes = mes2; if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id)) message.swipes[message.swipe_id] = mes2; };
        if (s.session || s.replyBusy) {
            tellRefusals();
            if (!kept.length) return { receipts: [], problems: refusals, deferred: true };   // (else saved with the next reply: its own save writes the chat)
            store1(withAssist(mes, kept.map(line => line.raw), { next: true }));
            redraw(index, message);
            return { receipts: [], problems: refusals, deferred: true, lines: kept.map(line => line.raw) };
        }
        if (!kept.length) { tellRefusals(); return { index, type: 'late', receipts: [], steps: [], problems: refusals, told: [] }; }
        const main = block === null ? [] : readBlock(index, block).lines;   // the cap counts block + previous late lines first, as a Re-read does
        const used = main.length + lateLines(index, main.map(line => line.raw)).length;
        const result = await captureLines(index, [], mes, 'late', { assist: kept, used });
        store1(withCaps(markOff(withAssist(mes, kept.map(line => line.raw)), result.off, mes.trimEnd().length), mes.trimEnd().length));
        if (store.dirty()) {
            if (store.saveIdle?.() !== true) await trySave('after the safety net\'s lines');
        } else await saveText();
        redraw(index, message);
        const turn = { index, type: 'late', receipts: result.receipts, steps: result.steps, problems: [...refusals, ...result.problems], told: [] };
        events?.emit('turn', turn);
        return turn;
    }

    return { captureLate };
}
