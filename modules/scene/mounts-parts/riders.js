// Who a mount row's `where` says is on it: "ridden by Wessel and Tam" → ['Wessel', 'Tam'].

const RIDDEN = /^\s*(?:ridden|rode|rides|riding|led|leads|leading|pulled|pulling|driven|driving)\s+by\s+(.+?)\s*$/i;

/** The names a `where` like "ridden by Wessel, Tam and Mara" gives (in order, no repeats); [] when it names nobody. */
export function ridersOf(where) {
    const match = RIDDEN.exec(String(where ?? ''));
    if (!match) return [];
    const names = match[1].split(/\s*(?:,|&|\band\b)\s*/i).map(name => name.trim()).filter(Boolean);
    return [...new Set(names)];
}
