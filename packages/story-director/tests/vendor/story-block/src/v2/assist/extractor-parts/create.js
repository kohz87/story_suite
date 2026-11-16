// The extractor runner: its answer size and the factory that reads each finished reply.

import { extractBlock, parseChanges, stripBlock, withoutReasoning } from '../../capture.js';
import { BACKGROUND, SETTING, TIMEOUT_MS, estimateTokens, normalizeType, withTimeout } from '../common.js';
import { DEFAULT_KINDS, allowedKinds } from '../safety.js';
import { mapPlaces, whereNow, worldKnown } from '../where.js';
import { allowedGrammar, grammarKind } from './grammar.js';
import { extractorPrompt } from './prompt.js';
import { notWritten } from './not-written.js';
import { parseExtractorAnswer } from './answer.js';

export const ANSWER_TOKENS = 400;

/**
 * The extractor. `deps`: { callModel(prompt, { maxTokens, profile }) → text, settings() → the module's
 * settings, grammar() → the kinds' one-line grammars (module-id order), capture(text, { index, swipe })
 * → the host's capture of extra change lines for that carrier, chatId(), log, warn, timeoutMs, timer,
 * where() → { here: { name, kind, region }, places: [{ name, aliases?, region?, x?, y? }], time: text, world?: { events, factions } }: the scene's
 * place, the map's places and the story's date and time; each part may be missing, and a throwing where is none }.
 * Returns { afterReply(reply) }.
 */
export function createExtractor({ callModel, settings, grammar, capture, chatId, log, warn, timeoutMs = TIMEOUT_MS, timer, where = null }) {
    // Carriers and swipes already read (whatever came of it), by chat.
    const done = new Set();

    // Each entry names its chat (`chat`), so a reply's note can tell the extractor failed on it.
    function note(outcome, entry = {}) {
        let chat = '';
        try { chat = String(chatId?.() ?? ''); } catch { chat = ''; }
        const item = log.add({ helper: 'extractor', outcome, chat, ...entry });
        if (['failed', 'timeout'].includes(outcome)) warn(`the reply's changes were not read: ${entry.message}`);
        return item;
    }

    /**
     * afterReply({ index, swipe, type, mes, lines?, capture? }): `mes` is the reply as stored (its block
     * hidden), `lines` the change lines its capture read (raw; else read from `mes`). Runs after every
     * captured reply while the safety net is on; resolves to what `capture` returned, or null when it did
     * not run or found nothing missing. `reply.capture(text, at, { assist: true })` (the host's, per reply)
     * wins over the one given at creation. Never throws.
     */
    async function afterReply(reply = {}) {
        try {
            const values = settings();
            if (values?.[SETTING.extractor] !== true) return null;
            const type = normalizeType(reply.type);
            if (BACKGROUND.includes(type) || type === 'continue') return null;
            const index = Number(reply.index);
            const swipe = Number.isInteger(reply.swipe) ? reply.swipe : 0;
            if (!Number.isInteger(index) || index < 0) return null;
            const mes = String(reply.mes ?? reply.text ?? '');
            // The story as capture reads it: closed reasoning (<think>…</think>) is not story.
            const story = stripBlock(withoutReasoning(mes)).trim();
            if (!story) return null;
            const key = `${chatId() ?? ''}|${index}|${swipe}|${reply.sid ?? ''}`;   // (a replacement reply reuses index and swipe, not its record ID)
            if (done.has(key)) return null;
            done.add(key);
            const at = { index, swipe };
            const allow = allowedKinds(values?.[SETTING.extractorKinds] ?? DEFAULT_KINDS);
            const all = (grammar() ?? []).map(line => String(line ?? '').trim()).filter(line => grammarKind(line));
            const lines = allowedGrammar(all, allow);
            if (!lines.length) {
                note('skipped', { ...at, message: all.length ? 'none of the allowed kinds is on' : 'no change-line kinds are known' });
                return null;
            }
            const feed = typeof reply.capture === 'function' ? reply.capture : capture;
            if (typeof feed !== 'function') {
                note('failed', { ...at, message: 'Story Block offers no capture for extra lines' });
                return null;
            }
            const written = Array.isArray(reply.lines) ? reply.lines.map(String)
                : parseChanges(extractBlock(mes) ?? '').lines.map(line => line.raw);
            let seen = null;
            try { seen = typeof where === 'function' ? where() : null; } catch { seen = null; }
            const places = mapPlaces(seen?.places);
            const around = whereNow({ here: seen?.here, places, time: seen?.time });
            // What the Chronicle holds, told only when a world or faction kind is among the allowed ones.
            if (lines.some(line => ['world', 'faction'].includes(grammarKind(line)))) Object.assign(around, worldKnown(seen?.world));
            const check = { places, here: around.here?.name ?? '' };
            const prompt = extractorPrompt(story, lines, written, around);
            const profile = String(values?.[SETTING.extractorProfile] ?? '').trim() || String(values?.[SETTING.profile] ?? '');
            let answer;
            try {
                answer = await withTimeout(() => callModel(prompt, { maxTokens: ANSWER_TOKENS, profile, helper: 'extractor' }), timeoutMs, timer);
            } catch (error) {
                note(error?.code === 'TIMEOUT' ? 'timeout' : 'failed', { ...at, message: error?.message ?? String(error) });
                return null;
            }
            const parsed = parseExtractorAnswer(answer, [...new Set(lines.map(grammarKind))], allow, check);
            // `written` mixes the block's lines with the reply before's late ones, so the scene kinds are left to the host's
            // capture (turn.js captureAssist), which knows which lines are the block's; here only repeats are dropped.
            const missing = notWritten(parsed.lines, written, { scene: [] });
            // What it wrote that the reader is told was refused (Problems on the reply): never applied.
            const refused = parsed.refused.filter(item => item.problem).map(({ line, why }) => ({ line, why }));
            if (!missing.length && !refused.length) {
                note('nothing', { ...at, dropped: parsed.dropped, tokens: estimateTokens(prompt) });
                return null;
            }
            // Keep even a refused or duplicate place for the host's end-of-reply presence check.
            const placeLines = [...parsed.lines, ...parsed.refused.map(item => item.line)].filter(raw => parseChanges(raw).lines[0]?.kind === 'place');
            const result = await feed(missing.join('\n'), at, { assist: true, ...(refused.length ? { refused } : {}), ...(placeLines.length ? { placeLines } : {}) });
            if (!missing.length) {
                note('nothing', { ...at, dropped: parsed.dropped, tokens: estimateTokens(prompt), message: `${refused.length === 1 ? 'a line was' : `${refused.length} lines were`} refused` });
                return result ?? null;
            }
            note('lines', { ...at, lines: missing.length, dropped: parsed.dropped, tokens: estimateTokens(prompt), ...(result?.deferred ? { message: 'applied on the next reply' } : {}) });
            return result ?? null;
        } catch (error) {
            note('failed', { index: reply?.index ?? null, swipe: reply?.swipe ?? null, message: error?.message ?? String(error) });
            return null;
        }
    }

    return { afterReply };
}
