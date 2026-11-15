// Turning on a pack's data modules in this chat, one by one, after its install.

/**
 * Turns on the data modules of pack `packId` in this chat, one by one, as Settings → Data modules' "Enable for this chat" does (`dm.pin`
 * with the hashes the offer shows), and saves the chat at once so the choice is on disk and the tab shows without a reply or a reload.
 * `sdk`: query and command; `save()`: the store's save now; `still()`: false once the chat the click was made in is not the open one (nothing more is
 * pinned then). → `{ pinned, failed: [message], total, moved }`.
 */
export async function enableDataModules({ sdk, packId, save = null, still = () => true }) {
    let rows = [];
    try { rows = sdk.query('dataModules.setup') ?? []; } catch { rows = []; }
    const mine = rows.filter(row => row?.packId === packId);
    const out = { pinned: 0, failed: [], total: mine.length, moved: false };
    for (const row of mine) {
        if (row.pinned) continue;
        // Checked before each pin: the chat may have changed while the earlier ones were on their way.
        if (!still()) { out.moved = true; break; }
        if (row.available === false) { out.failed.push(`${row.definition?.name ?? row.module} is waiting: ${row.reason || 'not ready'}`); continue; }
        let result = null;
        try { result = await sdk.command('dm.pin', { module: row.module, hash: row.hash, packHash: row.packHash, subjects: [] }); } catch (error) { result = { ok: false, message: error?.message ?? String(error) }; }
        if (result?.ok) out.pinned += 1;
        else out.failed.push(`${row.definition?.name ?? row.module}: ${result?.message ?? 'not enabled'}`);
    }
    if (out.pinned && typeof save === 'function') { try { await save(); } catch { /* the store tells a failed save and tries again */ } }
    return out;
}
