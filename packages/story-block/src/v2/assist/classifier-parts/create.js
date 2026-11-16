// The classifier runner: its answer size, the tail line that goes with a pre-roll and the factory that asks the model.

import { LEAN_RPG_FEATURE } from '../../../../../../modules/rpg/names.js';
import { readSheet } from '../../../../../../modules/rpg/read.js';
import { BACKGROUND, SETTING, TIMEOUT_MS, estimateTokens, hashText, normalizeType, withTimeout } from '../common.js';
import { CHECK_KIND, PRECHECK } from './names.js';
import { classifierPrompt } from './prompt.js';
import { parseClassifierAnswer } from './answer.js';
import { claimed } from './precheck.js';

export const ANSWER_TOKENS = 60;

// The tail line that goes with a pre-roll: the static instruction asks for a check line on every
// uncertain action (F16), so the reply is told this one is done. Worded so it holds even when the
// pre-roll could not be committed.
export const ROLLED_LINE = 'If [Happened] already shows a check for the reader\'s latest attempt, tell that result in the scene and write no new check line for it.';

/**
 * The classifier. `deps`: { callModel(prompt, { maxTokens, profile }) → text, settings(view) → the
 * module's settings, chat() → SillyTavern's chat array, chatId() → the open chat's id,
 * hasKind(kind) → whether a module keeps that change-line kind, skip.peek() → whether the reader chose "Send without the RPG for now" (no dice for the next reply), log (createRunLog), warn(text),
 * timeoutMs, timer }. Returns { beforeGenerate(view, info?) }.
 */
export function createClassifier({ callModel, settings, chat, chatId, hasKind, log, warn, timeoutMs = TIMEOUT_MS, timer, skip: noDice = { peek: () => false } }) {
    // Messages already asked about in this session (whatever the answer), by chat and key, so a
    // swipe, a regenerate or a failed call never asks again.
    const asked = new Map();

    function note(outcome, entry = {}) {
        const item = log.add({ helper: 'classifier', outcome, ...entry });
        if (['failed', 'timeout', 'unreadable'].includes(outcome)) warn(`the pre-roll check was skipped: ${entry.message}`);
        return item;
    }

    /**
     * beforeGenerate(view, info?): { lines, commands: [{ type: 'assist.precheck', payload }] } when the
     * reader's new message is an uncertain attempt, else null. `info.type` (when the host passes it) is
     * the generation type. A swipe or regeneration reuses a successful classification, but rolls anew
     * when the old reply's claim was retracted.
     */
    async function beforeGenerate(view, info = {}) {
        const values = settings(view);
        if (values?.[SETTING.classifier] !== true) return null;
        // The RPG rolls only on its fight board: with it on and a Character block in the chat, this pre-roll steps aside (two sets of dice would disagree).
        if (view?.feature?.(LEAN_RPG_FEATURE) === true && readSheet(view.state).characters.length) return null;
        const type = normalizeType(info?.type);
        if (BACKGROUND.includes(type) || !['normal', 'regenerate', 'swipe'].includes(type)) return null;
        // A swipe reuses the reader message before its reply; a Continue never prepares a roll.
        const messages = chat() ?? [];
        const index = type === 'swipe' ? messages.length - 2 : messages.length - 1;
        const last = messages[index];
        if (!last?.is_user) return null;
        const text = String(last.mes ?? '').trim();
        if (!text) return null;
        const key = `${index}-${hashText(text)}`;
        const memo = `${chatId() ?? ''}|${key}`;
        if (claimed(view?.state, key)) {
            return null;
        }
        // "Send without the RPG for now" promises no dice: no model call and no roll. The message is remembered as asked, so the swipe of that
        // reply (the flag is gone by then) stays as quiet as the send was.
        if (type === 'normal' && noDice.peek()) {
            asked.set(memo, null);
            return null;
        }
        if (!hasKind(CHECK_KIND)) {
            note('skipped', { key, message: 'no module keeps checks' });
            return null;
        }
        const prepared = line => ({ lines: [ROLLED_LINE], commands: [{ type: PRECHECK, payload: { key, line } }] });
        if (asked.has(memo)) return asked.get(memo) ? prepared(asked.get(memo)) : null;
        asked.set(memo, null);
        const prompt = classifierPrompt(text);
        let answer;
        try {
            answer = await withTimeout(() => callModel(prompt, { maxTokens: ANSWER_TOKENS, profile: String(values?.[SETTING.profile] ?? '') }), timeoutMs, timer);
        } catch (error) {
            note(error?.code === 'TIMEOUT' ? 'timeout' : 'failed', { key, message: error?.message ?? String(error) });
            return null;
        }
        const parsed = parseClassifierAnswer(answer);
        if (parsed.none) {
            note('none', { key, tokens: estimateTokens(prompt) });
            return null;
        }
        if (parsed.error) {
            note('unreadable', { key, message: `the model's answer was not used: ${parsed.error}` });
            return null;
        }
        note('check', { key, line: parsed.line.raw, tokens: estimateTokens(prompt) });
        asked.set(memo, parsed.line);
        return prepared(parsed.line);
    }

    return { beforeGenerate };
}
