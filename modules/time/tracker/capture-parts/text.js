// Story Director v2, tracker part: thread names and summaries cut to their limits, and a line written back as text.

import { KEY_CHARS, SUMMARY_CHARS } from './limits.js';
import { clip } from './shared-clip.js';

// `Hook: Sheepfold Wolves`, a kind and a colon written in front of the name (v1 0.9.10). Invisible
// format marks go and the name is NFC, so "Ro\u200Bpe" and "\u202ERope" are the thread "Rope", as
// Story Block reads its own names (names.js).
export function bareName(name) {
    const text = String(name ?? '').replace(/\p{Cf}+/gu, '').normalize('NFC').replace(/\*\*|__|[*`]/g, '').trim();
    const prefixed = text.match(/^([A-Za-z]+)\s*:\s*(\S.*)$/s);
    return prefixed && ['agenda', 'event', 'hook', 'quest', 'clock', 'beat', 'secret', 'arc'].includes(prefixed[1].toLowerCase()) ? prefixed[2].trim() : text;
}

/** The line as v2 wrote it, for history and problems (at most QUOTE_CHARS long). */
export function lineText(line) {
    const labels = Object.entries(line?.labels ?? {}).map(([label, value]) => ` | ${label}: ${value}`).join('');
    return clip(`${line?.op ?? ''} ${line?.kind ?? ''} ${line?.name ?? ''}${line?.text ? ` — ${line.text}` : ''}${labels}`.trim());
}

/** A thread name at most KEY_CHARS long: cut at the last space before the limit when there is one. */
export function capKey(key) {
    const text = String(key ?? '');
    if (text.length <= KEY_CHARS) return text;
    const head = text.slice(0, KEY_CHARS);
    const space = head.lastIndexOf(' ');
    return (space >= KEY_CHARS / 2 ? head.slice(0, space) : head).trim();
}

/** A summary at most SUMMARY_CHARS long, ending "…" when cut: at the last space past half of it when there is one. */
export function capSummary(summary) {
    const text = String(summary ?? '');
    if (text.length <= SUMMARY_CHARS) return text;
    const head = text.slice(0, SUMMARY_CHARS - 1);
    const space = head.lastIndexOf(' ');
    return `${(space >= SUMMARY_CHARS / 2 ? head.slice(0, space) : head).trimEnd()}…`;
}
