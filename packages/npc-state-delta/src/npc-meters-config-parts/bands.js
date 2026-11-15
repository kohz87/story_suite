// Parsing band words from a settings text and finding the band word for a value.
import { MAX_BANDS } from './limits-ladder.js';
import { isObject, isInt } from './values.js';
import { clean, intOr } from './text.js';

const BAND_WORD_MAX = 24;

/**
 * Band words from a settings text: `doubtful 25, steady 60, devoted` → [{ upTo: 25, word }, { upTo:
 * 60, word }, { upTo: null, word: 'devoted' }]: a value up to a band's number takes its word, above
 * the last number the band without one. A list of { upTo, word } is read too. At most eight.
 */
export function parseBands(value) {
    // A pack's bands (Story Block PACKS.md): [{ at, word }] lowest first, each word holding from its
    // `at` up to the next band's: the same bands written as "up to" the next band's start.
    if (Array.isArray(value) && value.some(item => isObject(item) && item.at !== undefined && item.upTo === undefined)) {
        const from = value.filter(item => isObject(item) && isInt(intOr(item.at, null))).map(item => ({ at: intOr(item.at, null), word: item.word }))
            .sort((a, b) => a.at - b.at).slice(0, MAX_BANDS);
        value = from.map((item, index) => ({ word: item.word, upTo: index + 1 < from.length ? from[index + 1].at - 1 : null }));
    }
    const items = Array.isArray(value) ? value : String(value ?? '').split(/[,;\n]/);
    const out = [];
    let top = null;
    for (const item of items) {
        let word;
        let upTo;
        if (isObject(item)) {
            word = clean(item.word, BAND_WORD_MAX);
            upTo = intOr(item.upTo ?? item.to, null);
        } else {
            const match = /^(.*?)\s*(?:(?:<=|≤|up to|to)\s*)?([+\-−]?\d{1,4})?$/u.exec(clean(item, 60));
            if (!match) continue;
            word = clean(match[1], BAND_WORD_MAX);
            upTo = match[2] === undefined ? null : Number(match[2].replace('−', '-'));
        }
        if (!word || !/^[\p{L}][\p{L}\p{N}' -]*$/u.test(word)) continue;
        if (upTo === null) { top ??= word; continue; }
        if (out.length >= MAX_BANDS || out.some(band => band.upTo === upTo)) continue;
        out.push({ upTo, word });
    }
    out.sort((a, b) => a.upTo - b.upTo);
    if (top && out.length < MAX_BANDS) out.push({ upTo: null, word: top });
    return Object.freeze(out.map(band => Object.freeze(band)));
}

/** The band word for `value` ('' when the meter has no bands). */
export function bandWord(bands, value) {
    const list = Array.isArray(bands) ? bands : [];
    return list.find(band => band.upTo === null || value <= band.upTo)?.word ?? '';
}
