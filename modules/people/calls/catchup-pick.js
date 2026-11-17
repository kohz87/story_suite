/* NPC State rolling catch-up: who the next captured reply's Refresh takes (role: catchup-pick). Pure: it reads the last replies' marks and returns ids.
   Rules (N = replies a person waits between Refreshes, K = people one reply may take):
   - eligible: in the last N replies (this one counts) and N or more replies since their last Refresh (catch-up or manual);
   - at most K × max(1, N-1) catch-up Refreshes in any N consecutive replies, so this reply gets at most K and fewer when the window is full;
   - order: (1) not refreshed for 3N replies, longest-waiting first; (2) the most seen in the last N replies; (3) ties: last refreshed, oldest first, then id.
   A person the picker leaves keeps their place: nothing is remembered, so they lead next time. */

/** `history`: the replies oldest to newest, the newest being this one: [{ seen: [ids], took: [ids], manual: [ids] }]. Returns the ids to Refresh now. */
export function pickRolling(history, every, people) {
    const waits = Math.max(0, Math.round(Number(every) || 0));
    const per = Math.max(1, Math.min(3, Math.round(Number(people) || 1)));
    const list = Array.isArray(history) ? history : [];
    if (!waits || !list.length) return [];
    const now = list.length - 1;
    const recent = list.slice(Math.max(0, list.length - waits));
    const seen = new Map();
    for (const reply of recent) for (const id of new Set(reply?.seen || [])) if (id) seen.set(id, (seen.get(id) || 0) + 1);
    // Catch-up Refreshes already taken in the N-1 replies before this one (this reply makes N consecutive).
    const before = list.slice(Math.max(0, now - (waits - 1)), now);
    const used = before.reduce((sum, reply) => sum + new Set(reply?.took || []).size, 0);
    const slots = Math.min(per, per * Math.max(1, waits - 1) - used);
    if (slots <= 0) return [];
    // Replies since the person's last Refresh; one never refreshed (as far as the history reaches) waits since the first reply they were seen in (that reply counts).
    const waited = id => {
        for (let at = now - 1; at >= 0; at -= 1) if ((list[at]?.took || []).includes(id) || (list[at]?.manual || []).includes(id)) return now - at;
        const first = list.findIndex(reply => (reply?.seen || []).includes(id));
        return first < 0 ? 0 : now - first + 1;
    };
    const rows = [...seen].map(([id, count]) => ({ id, count, waited: waited(id) })).filter(row => row.waited >= waits);
    const overdue = row => row.waited >= 3 * waits;
    rows.sort((a, b) => (overdue(b) - overdue(a))
        || (overdue(a) && overdue(b) ? b.waited - a.waited || b.count - a.count : b.count - a.count || b.waited - a.waited)
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return rows.slice(0, slots).map(row => row.id);
}
