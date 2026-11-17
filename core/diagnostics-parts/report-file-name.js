// The file name a saved report gets.

/** The file name a saved report gets: story-suite-diagnostics-2026-10-22-0930.txt. */
export function reportFileName(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `story-suite-diagnostics-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.txt`;
}
