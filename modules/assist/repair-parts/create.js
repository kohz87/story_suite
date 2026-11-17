// The repair runner: when a captured reply came with no <Changes> block, one call on the Quick profile writes the block it should have had.

import { extractBlock, parseChanges, stripBlock, withoutReasoning, assistSections, repairState } from '../../../core/capture.js';
import { BACKGROUND, SETTING, TIMEOUT_MS, estimateTokens, normalizeType, withTimeout } from '../common.js';
import { REPAIR_KINDS, allowedKinds } from '../safety.js';
import { mapPlaces, whereNow } from '../where.js';
import { allowedGrammar, grammarKind, notWritten, parseExtractorAnswer } from '../extractor.js';
import { repairPrompt } from './prompt.js';
import { capStretch } from './time-cap.js';

export const REPAIR_TOKENS = 600;

/**
 * The repairer. `deps`: the extractor's (callModel, settings, grammar, capture, chatId, log, warn, timeoutMs, timer, where) and `state()` → the story's
 * state lines before the reply (Place, Present, Wallet, Carried …). Returns { afterReply(reply) }.
 */
export function createRepairer({ callModel, settings, grammar, capture, chatId, log, warn, timeoutMs = TIMEOUT_MS, timer, where = null, state = () => [], persona = () => '' }) {
    const done = new Set();

    function note(outcome, entry = {}) {
        let chat = '';
        try { chat = String(chatId?.() ?? ''); } catch { chat = ''; }
        const item = log.add({ helper: 'repair', outcome, chat, ...entry });
        if (['failed', 'timeout'].includes(outcome)) warn(`the reply's missing changes were not repaired: ${entry.message}`);
        return item;
    }

    /**
     * afterReply({ index, swipe, type, mes, missing, capture? }): `missing` is the host's word that the reply came with no <Changes> block. Runs only
     * then, and only once per carrier and swipe, and never for a reply that already holds a stored repair. Resolves to
     * { attempted: false } when it did not run, else { attempted: true, repair: 'ok' | 'nothing' | 'failed', result?, message? }. Never throws.
     */
    async function afterReply(reply = {}) {
        const skip = { attempted: false };
        let key = null;
        try {
            if (settings()?.[SETTING.repair] !== true || reply.missing !== true) return skip;
            const type = normalizeType(reply.type);
            if (BACKGROUND.includes(type) || type === 'continue') return skip;
            const index = Number(reply.index);
            const swipe = Number.isInteger(reply.swipe) ? reply.swipe : 0;
            if (!Number.isInteger(index) || index < 0) return skip;
            const mes = String(reply.mes ?? reply.text ?? '');
            const story = stripBlock(withoutReasoning(mes)).trim();
            if (!story || extractBlock(mes) !== null) return skip;
            const stored = assistSections(mes);
            if (stored.now.length || stored.next.length) return skip;
            if (repairState(mes) === 'discarded') return skip;   // the reader discarded this reply's repair: it is never asked again (the mark is in the reply's text, so a reload or a swipe back keeps it)
            key = `${chatId() ?? ''}|${index}|${swipe}|${reply.sid ?? ''}`;
            if (done.has(key)) return skip;
            done.add(key);
            const at = { index, swipe };
            const allow = allowedKinds(REPAIR_KINDS);
            const all = (grammar() ?? []).map(line => String(line ?? '').trim()).filter(line => grammarKind(line));
            const lines = allowedGrammar(all, allow);
            const feed = typeof reply.capture === 'function' ? reply.capture : capture;
            if (!lines.length || typeof feed !== 'function') {
                note('skipped', { ...at, message: lines.length ? 'Story Block offers no capture for extra lines' : 'no change-line kinds are known' });
                return { attempted: true, repair: 'failed', message: 'the repair could not run' };
            }
            let seen = null;
            try { seen = typeof where === 'function' ? where() : null; } catch { seen = null; }
            const places = mapPlaces(seen?.places);
            const around = whereNow({ here: seen?.here, places, time: seen?.time });
            let facts = [];
            try { facts = state() ?? []; } catch { facts = []; }
            let who = '';
            try { who = String(persona?.() ?? ''); } catch { who = ''; }
            const prompt = repairPrompt(story, lines, facts, around, who);
            let answer;
            try {
                answer = await withTimeout(() => callModel(prompt, { maxTokens: REPAIR_TOKENS, role: 'quick', helper: 'repair' }), timeoutMs, timer);
            } catch (error) {
                const message = error?.message ?? String(error);
                note(error?.code === 'TIMEOUT' ? 'timeout' : 'failed', { ...at, message });
                done.delete(key);   // a failed ask is asked again by Re-read; an answer (lines or nothing) is not
                return { attempted: true, repair: 'failed', message };
            }
            const parsed = parseExtractorAnswer(answer, [...new Set(lines.map(grammarKind))], allow, { places, here: around.here?.name ?? '' }, { repair: true });
            const capped = capStretch(parsed.lines, story);
            const missing = notWritten(capped.lines, [], { scene: [] });
            const refused = [...parsed.refused.filter(item => item.problem).map(({ line, why }) => ({ line, why })), ...capped.cut];
            if (!missing.length && !refused.length) {
                note('nothing', { ...at, dropped: parsed.dropped, tokens: estimateTokens(prompt) });
                return { attempted: true, repair: 'nothing' };
            }
            const placeLines = [...parsed.lines, ...parsed.refused.map(item => item.line)].filter(raw => parseChanges(raw).lines[0]?.kind === 'place');
            const result = await feed(missing.join('\n'), at, { assist: true, repair: true, ...(refused.length ? { refused } : {}), ...(placeLines.length ? { placeLines } : {}) });
            note(missing.length ? 'lines' : 'nothing', { ...at, ...(missing.length ? { lines: missing.length } : {}), dropped: parsed.dropped, tokens: estimateTokens(prompt) });
            return { attempted: true, repair: missing.length ? 'ok' : 'nothing', result: result ?? null };
        } catch (error) {
            if (key) done.delete(key);
            const message = error?.message ?? String(error);
            note('failed', { index: reply?.index ?? null, swipe: reply?.swipe ?? null, message });
            return { attempted: true, repair: 'failed', message };
        }
    }

    return { afterReply };
}
