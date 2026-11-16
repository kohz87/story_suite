// Story Director v2, part **arc**: normalizing and truncating plan text to plain single-line strings.

/**
 * `value` as one plain line of at most `points` code points: control and format characters out, `<`
 * and `>` out (no markup reaches a screen or the prompt), runs of space made one, NFC. Cut at a space
 * past half of it when there is one.
 */
export function flat(value, points) {
    const cleaned = String(value ?? '')
        .normalize('NFC')
        .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
        .replace(/[<>]/g, '')
        .replace(/\*\*|__|`/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const chars = [...cleaned];
    if (chars.length <= points) return cleaned;
    const head = chars.slice(0, points).join('');
    const space = head.lastIndexOf(' ');
    return (space >= head.length / 2 ? head.slice(0, space) : head).trim();
}

// A separator the change-line grammar reads (` | `, ` — `) never survives inside a part, so the text
// form reads back as the same plan.
export const part = (value, points) => flat(String(value ?? '').replace(/\s[|—–]\s/g, ' ').replace(/\|/g, '/'), points);
