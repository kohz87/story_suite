// Story Director v2, journal: the row shape and the wording of a day's lines (word-end cut, sentence summary).

// A digest cuts a long line at a fixed length ("… scarred thi…"): shown, it ends at a word end instead ("… scarred…").
export const wordEnd = value => {
    const line = String(value ?? '');
    if (!line.endsWith('…')) return line;
    const body = line.slice(0, -1);
    const at = body.search(/\s\S*$/);
    if (at <= 0) return line;
    const head = body.slice(0, at).replace(/[\s,;:|–—-]+$/u, '');
    return head.endsWith('…') ? head : `${head}…`;
};
// `fit` is `wordEnd` for the screen's rows and the identity for the narrator's input (see foldsOf: `display`).
export const same = value => value;
export const plain = (detail, fit = same) => ({ title: '', chip: '', detail: fit(detail), note: '', since: '', stepsLabel: '', steps: [], tags: [] });

// The stored one-liner ("to A, B; took on C; finished D; 1100 copper in, 2 out") read as a sentence: "Went to A, B, took on C, finished D, 1100 copper in, 2 out."
export function summaryOf(short) {
    const parts = String(short ?? '').replace(/[.\s]+$/, '').split('; ').filter(Boolean);
    if (!parts.length) return '';
    parts[0] = parts[0].startsWith('to ') ? `Went ${parts[0]}` : parts[0][0].toUpperCase() + parts[0].slice(1);
    return `${parts.join(', ')}.`;
}
