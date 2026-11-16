// The reader of the prompt's size: the turn's parts counted by estimate, then by SillyTavern's tokenizer, and the footer bar's numbers.

import { promptSize, redactSentOf } from '../../../host-ui.js';
import { DEFAULT_TAIL_BUDGET, estimateTokens } from '../../../../../../../core/prompt.js';

const ownParts = own => (Array.isArray(own) ? own.filter(part => part && typeof part.text === 'string' && part.text) : []);


/**
 * The reader of the prompt's size. `promptParts()` is the turn's preview ({ parts, fit, own } or a bare parts list; it throws
 * or answers nothing with no chat open), `countTokens(text)` SillyTavern's tokenizer (optional, may be async).
 * → { available, read(), readExact(base) }:
 *   `read()` → null (no chat to read) or { parts, fit, own, budget, size, exact: false, names } at once, counted at four
 *   characters a token; `readExact(base)` → a promise of the same with the tokenizer's counts and `exact: true`, or null when it
 *   cannot count (the estimate stays).
 */
export function createPromptReader({ registry, settings, promptParts = null, countTokens = null }) {
    const names = id => (id === 'story-suite' ? 'Story Suite' : registry?.module?.(id)?.name ?? id);
    // What the reader may see of a module's text (a module's `hooks.redactSent`); the prompt itself is never changed.
    const redact = redactSentOf(registry);
    const tailBudget = () => {
        const value = settings()?.tailBudget;
        return Number.isInteger(value) && value > 0 ? value : DEFAULT_TAIL_BUDGET;
    };
    const available = typeof promptParts === 'function';
    function read() {
        if (!available) return null;
        let parts = null;
        let fit = null;
        let own = [];
        try {
            const got = promptParts();
            parts = Array.isArray(got) ? got : got?.parts;
            fit = Array.isArray(got) ? null : got?.fit ?? null;
            own = Array.isArray(got?.own) ? got.own : [];
        } catch { parts = null; }
        if (!Array.isArray(parts)) return null;
        // A small context cuts the notes' budget (prompt.js contextFit).
        const budget = Number.isInteger(fit?.budget) ? fit.budget : tailBudget();
        return { parts, fit, own, budget, names, redact, exact: false, tokensOf: estimateTokens, size: promptSize(parts, { names, budget, own }) };
    }
    async function readExact(base) {
        if (typeof countTokens !== 'function' || !base) return null;
        const { parts, own, budget } = base;
        // SillyTavern's tokenizer: every text counted once, then the same sums with its numbers.
        const texts = [...new Set([
            ...parts.map(part => String(part?.text ?? '')),
            parts.filter(part => part?.place === 'static').map(part => part.text).join('\n\n'),
            parts.filter(part => part?.place !== 'static').map(part => part.text).filter(Boolean).join('\n'),
            ...ownParts(own).map(part => part.text),
        ])];
        try {
            const counts = await Promise.all(texts.map(text => Promise.resolve().then(() => countTokens(text))));
            if (!counts.every(n => Number.isFinite(n) && n >= 0)) return null;
            const known = new Map(texts.map((text, at) => [text, Math.round(counts[at])]));
            const tokensOf = text => known.get(text) ?? estimateTokens(text);
            return { ...base, exact: true, tokensOf, size: promptSize(parts, { names, budget, own, tokensOf }) };
        } catch { return null; }
    }
    return { available, read, readExact };
}

/** The footer bar's numbers from a read: { none: true } with no chat, else { tail, budget, total, exact, over, ratio }. */
export function footerSummary(read) {
    if (!read) return { none: true };
    const { size, budget } = read;
    return { none: false, tail: size.tail, budget, total: size.total, exact: read.exact, over: size.tail > budget, ratio: budget > 0 ? Math.min(1, size.tail / budget) : 0 };
}
