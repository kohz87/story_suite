/* Removal of message citation groups such as [m1, m2] from scanner text. */

// (stage 73) The scanner's transcripts label messages "[m12] ..." so evidence can cite them; the model sometimes also appends the
// citation to ordinary fields ("... distressed demeanor [m1, m2]"). stripMessageCitations removes such citation groups anywhere in a
// text, with the space/punctuation they leave: `[m1]`, `[m1, m2]`, `[m3-m5]`, `[m3\u20135]`, `(m1, m2)`, `[message 12]`, `[messages 3, 4]`,
// `[message 12 \u00b7 user]`. Only groups made entirely of citation tokens go; "[Rank F]", "(the left notched)" and an "m" inside a word stay.
// Lowercase only (the transcripts write "m" and "message"): a room "[M3]" stays.
const CITE_TOKEN = 'm\\d+(?:\\s*[-\u2013\u2014]\\s*m?\\d+)?';
const CITE_NUMS = '\\d+(?:\\s*[-\u2013\u2014]\\s*\\d+)?(?:\\s*(?:,|;|&|and)\\s*\\d+(?:\\s*[-\u2013\u2014]\\s*\\d+)?)*';
const CITE_GROUP = new RegExp(
    `[\\[(]\\s*(?:(?:${CITE_TOKEN})(?:\\s*(?:,|;|&|and)\\s*(?:${CITE_TOKEN}))*|messages?\\s*#?\\s*${CITE_NUMS}(?:\\s*[\u00b7\u2022|:]\\s*[A-Za-z]+)?)\\s*[\\])]`, 'g');
export function stripMessageCitations(value) {
    if (typeof value !== 'string' || !/[\[(]\s*(?:m\d|messages?\b)/.test(value)) return value;
    const MARK = '\u0000';
    const marked = value.replace(CITE_GROUP, MARK);
    if (marked === value) return value;
    return marked
        .replace(/[ \t\r\n]*\u0000(?:[ \t\r\n]*\u0000)*[ \t\r\n]*/g, (match, offset, whole) => {
            const next = whole.slice(offset + match.length)[0];
            if (offset === 0 || next === undefined || /[.,;:!?)\]]/.test(next)) return '';
            return ' ';
        })
        .replace(/[,;]\s*$/, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}
