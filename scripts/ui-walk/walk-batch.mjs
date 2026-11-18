// Ends one walk run: reloads once to check every kept change stuck, puts them back, then sets the switches that change other rows together, reloads, checks and puts them back.
import { putBack } from './walk-section.mjs';
import { fail, shoot, same } from './walk-record.mjs';

const shownAs = v => (v === undefined ? '(row gone)' : v);

// Reload, open Settings, and read each page's records after it: each must read `r.before` (a fresh Settings just before the reload) when set, else `r.to`.
async function reloadAndRead(session, pages, list, out) {
  const saved = await session.reload();
  await session.openSettings();
  for (const { section } of pages) {
    const mine = list.filter(r => r.section === section);
    if (!mine.length) continue;
    await session.gotoSection(section);
    await session.controls();
    const values = await session.values();
    for (const r of mine) {
      if (!saved) r.notes.push('saves were still running 30 s after the last change when the page reloaded');
      const want = r.before === undefined ? r.to : r.before;
      r.checks.reload = same(values[r.id], want);
      if (!r.checks.reload) { fail(r, 'reload', `after a reload it reads ${shownAs(values[r.id])}, before it ${shownAs(want)}`); await shoot(session, r, 'reload', out); }
    }
  }
}

// Put each page's records back (last first), then open Settings fresh and check each reads its first value.
async function restoreAll(session, pages, list, out) {
  for (const { section } of [...pages].reverse()) {
    const mine = list.filter(r => r.section === section);
    if (!mine.length) continue;
    await session.gotoSection(section);
    for (const r of [...mine].reverse()) await putBack(session, r);
  }
  await session.closeSettings();
  await session.openSettings();
  for (const { section } of pages) {
    const mine = list.filter(r => r.section === section && r.checks.restored !== false);
    if (!mine.length) continue;
    await session.gotoSection(section);
    await session.controls();
    const values = await session.values();
    for (const r of mine) {
      r.checks.restored = same(values[r.id], r.from);
      if (!r.checks.restored) { fail(r, 'restored', `reads ${shownAs(values[r.id])} after putting ${r.from} back`); await shoot(session, r, 'restored', out); }
    }
  }
}

// One batch of switches that change other rows: set them all, reload and check, then put each back from a fresh page (the open page may not redraw after them), and check a fresh Settings.
async function gateRound(session, pages, gates, out) {
  const live = [];
  for (const r of gates) {
    await session.gotoSection(r.section);
    const control = (await session.controls()).find(c => c.id === r.id);
    if (!control || control.disabled) { r.checks.reload = null; r.notes.push('reload check not run: another switch in the batch hid or greyed it'); continue; }
    const now = (await session.values())[r.id];
    try { if (!same(now, r.to)) await session.set(control, r.to, now); live.push(r); } catch (error) { r.checks.reload = null; r.notes.push(`reload check not run: ${String(error.message).split('\n')[0]}`); }
  }
  // In a batch one switch can move another (a style preset and its prompt), so the reload must keep what a fresh Settings showed just before it.
  if (live.length) {
    await session.closeSettings();
    await session.openSettings();
    for (const r of live) {
      await session.gotoSection(r.section);
      await session.controls();
      r.before = (await session.values())[r.id];
      if (!same(r.before, r.to)) r.notes.push(`in the batch it read ${shownAs(r.before)} before the reload (another control in the batch moved it)`);
    }
    await reloadAndRead(session, pages, live, out);
  }
  for (const r of [...live].reverse()) {
    await session.reopenAt(r.section);
    await putBack(session, r);
  }
  await session.closeSettings();
  await session.openSettings();
  for (const r of gates) {
    if (r.checks.restored === false) continue;
    await session.gotoSection(r.section);
    await session.controls();
    const value = (await session.values())[r.id];
    r.checks.restored = same(value, r.from);
    if (!r.checks.restored) { fail(r, 'restored', `reads ${shownAs(value)} after putting ${r.from} back`); await shoot(session, r, 'restored', out); }
  }
}

/**
 * After every page was walked: `pages` = [{ section, kept, gates }] in walk order. Kept rows are reload-checked and restored together;
 * then the switches that change other rows in two batches, each with its own reload: first feature and other switches, then the
 * module switches (turning a module off turns its features off, so they are not in one batch). A switch that another switch
 * hid or greyed gets "not run".
 */
export async function finishCombo(session, pages, out) {
  const kept = pages.flatMap(p => p.kept);
  if (kept.length) {
    await reloadAndRead(session, pages, kept, out);
    await restoreAll(session, pages, kept, out);
  }
  const gates = pages.flatMap(p => p.gates);
  const isModule = r => r.id.startsWith('mod:');
  for (const round of [gates.filter(r => !isModule(r)), gates.filter(isModule)]) if (round.length) await gateRound(session, pages, round, out);
}
