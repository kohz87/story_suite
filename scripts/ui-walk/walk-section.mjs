// Walks one Settings page: changes each control the way a person does, checks what the page shows, its visible effect and what was stored, and reads a fresh Settings at the end of the page.
import { nextValue, skipReason, diffPaths } from './walk-plan.mjs';
import { checkEffect } from './walk-effects.mjs';
import { record, fail, shoot, same } from './walk-record.mjs';

// The line of a click error that says why (covered, hidden, greyed), else its first line.
const plain = error => String(error?.message ?? error).replace(/\u001b\[[0-9;]*m/g, '');
const why = error => plain(error).split('\n').map(l => l.trim()).filter(l => /intercepts pointer|not visible|not enabled|outside of the viewport|not stable/.test(l)).pop()
  ?? plain(error).split('\n')[0];
// "January: 31, …, December: 31" → "…, December: 32": the same format with its last number one up; undefined when it has none.
const bumpLastNumber = (text) => {
  const m = /(\d+)(?!.*\d)/s.exec(String(text ?? ''));
  return m ? `${text.slice(0, m.index)}${Number(m[1]) + 1}${text.slice(m.index + m[1].length)}` : undefined;
};
// What a change can do to the rest of the page: which controls are there, greyed and visible.
const shape = list => list.map(c => `${c.id}:${c.disabled ? 'd' : ''}${c.visible ? '' : 'h'}`).join('|');

async function changeOne(session, control, from, to, base, out) {
  const r = record(base, control, { from, to });
  const before = await session.controls();
  const values0 = await session.values();
  const store0 = await session.store();
  const look0 = await session.look();
  try {
    await session.set(control, to, from);
  } catch (error) {
    fail(r, 'click', `could not change it: ${why(error)}`);
    await shoot(session, r, 'click', out);
    return r;
  }
  const after = await session.controls();
  const shown = (await session.values())[control.id];
  r.checks.shown = same(shown, to);
  if (!r.checks.shown) fail(r, 'shown', `the page shows ${shown === undefined ? '(row gone)' : shown} after the change`);
  r.onPage = await session.values();
  const stored = diffPaths(store0, await session.store());
  r.stored = stored.map(d => d.path);
  r.checks.stored = stored.length > 0;
  if (!stored.length) fail(r, 'stored', 'nothing was stored (suite settings, chat metadata, device keys)');
  const effect = await checkEffect(session, control, { section: base.section, from, to, look0, look1: await session.look(), idsBefore: before.map(c => c.id), idsAfter: after.map(c => c.id) });
  if (effect) {
    r.effect = effect;
    r.checks.effect = effect.pass;
    if (effect.pass === false) fail(r, 'effect', `${effect.name}: ${effect.note}`);
    else r.notes.push(`${effect.name}: ${effect.note}`);
  }
  if (r.status === 'fail') await shoot(session, r, 'change', out);
  // Put back at once (and reload-checked with the switches): a module or feature switch, a change that adds, hides or greys
  // controls or moves other rows' values (a style preset rewrites its prompt), and a row whose effect was checked (so the next
  // row's effect is seen from the first state: Glass strength does nothing under Follow SillyTavern).
  const moved = Object.keys(values0).filter(k => k !== control.id && k in r.onPage && !same(values0[k], r.onPage[k]));
  if (moved.length) r.notes.push(`also changed ${moved.slice(0, 4).join(', ')}${moved.length > 4 ? ` (+${moved.length - 4})` : ''}`);
  r.gate = /^(mod|sub):/.test(control.id) || shape(before) !== shape(after) || moved.length > 0 || Boolean(effect);
  return r;
}

// A control that changes others: the open page must show what a fresh Settings shows. Leaves Settings open fresh at this page.
async function checkRedraw(session, r, section, out) {
  r.notes.push('put back at once, reload-checked with the switches batch');
  const onPage = r.onPage ?? {};
  delete r.onPage;
  await session.reopenAt(section);
  await session.controls();
  const fresh = await session.values();
  r.checks.reopen = same(fresh[r.id], r.to);
  if (!r.checks.reopen) fail(r, 'reopen', `Settings opened again reads ${fresh[r.id] === undefined ? '(row gone)' : fresh[r.id]}`);
  const stale = Object.keys(fresh).filter(k => k in onPage && !same(onPage[k], fresh[k]));
  r.checks.redraw = stale.length === 0;
  if (stale.length) fail(r, 'redraw', `the open page did not redraw after it: ${stale.slice(0, 4).map(k => `${k} showed ${onPage[k]}, stored ${fresh[k]}`).join('; ')}${stale.length > 4 ? ` (+${stale.length - 4})` : ''}`);
  if (!r.checks.reopen || stale.length) await shoot(session, r, 'redraw', out);
}

/** Sets a record's control on the open page back to `r.from`; false (and the record failed) when it cannot. */
export async function putBack(session, r) {
  let control = (await session.controls()).find(c => c.id === r.id);
  if (!control) { fail(r, 'restored', 'could not put it back: the control is not on the page'); return false; }
  // A feature greyed because every feature of its module went off (the card then reads off): the module switch comes on first.
  const module = /^sub:([^:]+):/.exec(r.id)?.[1];
  if (control.disabled && module) {
    const mod = (await session.controls()).find(c => c.id === `mod:${module}`);
    if (mod && (await session.values())[mod.id] === false) {
      await session.set(mod, true, false);
      r.notes.push('its module had gone off with all its features off; turned the module on to put it back');
      control = (await session.controls()).find(c => c.id === r.id) ?? control;
    }
  }
  const now = (await session.values())[r.id];
  if (same(now, r.from)) return true;
  try { await session.set(control, r.from, now); return true; } catch (error) { fail(r, 'restored', `could not put it back: ${why(error)}`); return false; }
}

// Walks one control (re-read from the page): returns { r, bucket } with bucket 'kept' (left changed), 'gate' (put back already) or none. `held.r` is the record once a change is under way.
async function walkControl(session, first, base, out, walked, held) {
  const control = (await session.controls()).find(c => c.id === first.id);
  if (!control) { return { r: record(base, first, { status: 'skip', notes: ['hidden by an earlier change on this page'] }) }; }
  if (control.disabled) { return { r: record(base, control, { status: 'skip', notes: ['greyed (its module or feature is off)'] }) }; }
  if (!control.visible) { return { r: record(base, control, { status: 'fail', checks: { visible: false }, notes: ['on the page but not visible (no box to click)'] }) }; }
  walked.add(control.id);
  const from = (await session.values())[control.id];
  const to = nextValue(control, from);
  if (to === undefined) { return { r: record(base, control, { status: 'skip', from, notes: ['no other value to pick'] }) }; }
  held.r = record(base, control, { from, to });
  let r = await changeOne(session, control, from, to, base, out);
  held.r = r;
  // A number that stored nothing gets one try a step down (a value at its top is clamped, not broken); text one try with its last number one up, keeping its format.
  const down = control.kind === 'txt' ? bumpLastNumber(from) : nextValue(control, from, -1);
  if ((control.kind === 'num' || control.kind === 'txt') && r.checks.stored === false && r.checks.click !== false && down !== undefined) {
    const again = (await session.controls()).find(c => c.id === control.id);
    if (again) {
      const second = await changeOne(session, again, from, down, base, out);
      second.notes.unshift(`${to} stored nothing (the page kept showing ${to}); tried ${down}`);
      second.shots.unshift(...r.shots);
      r = second;
      held.r = r;
    }
  }
  if (r.checks.click === false) return { r };
  if (!r.gate) return { r, bucket: 'kept' };
  await checkRedraw(session, r, base.section, out);
  await putBack(session, r);
  await session.reopenAt(base.section);
  await session.controls();
  return { r, bucket: 'gate' };
}

/**
 * Walks Settings page `base.section` in an open session and leaves its plain rows changed. A control that changes other controls
 * (a module or feature switch, one that hides, shows or greys rows or moves their values) or has an effect check is put back at once and returned in `gates`;
 * `walked` holds the ids already walked in this combo. Returns `{ results, kept, gates, broken? }` (broken: Settings would not open again after a control stopped the walk).
 */
export async function walkSection(session, base, walked, out) {
  const { section } = base;
  await session.gotoSection(section);
  const results = [];
  const kept = [];
  const gates = [];
  for (const first of await session.controls()) {
    const skip = skipReason(first);
    if (skip) { results.push(record(base, first, { status: 'skip', notes: [skip] })); continue; }
    if (walked.has(first.id)) { results.push(record(base, first, { status: 'skip', notes: ['same control as on an earlier page; walked there'] })); continue; }
    const held = { r: null };
    try {
      const done = await walkControl(session, first, base, out, walked, held);
      if (done.r) results.push(done.r);
      if (done.bucket === 'gate') gates.push(done.r);
      if (done.bucket === 'kept') kept.push(done.r);
    } catch (error) {
      // The walk itself stopped on this control: record it, open Settings fresh, put it back if it was changed, and go on.
      const r = held.r ?? record(base, first);
      fail(r, 'walk', `the walk stopped on it: ${why(error)}`);
      await shoot(session, r, 'walk', out);
      if (!results.includes(r)) results.push(r);
      try {
        await session.reopenAt(section);
        if (r.to !== undefined && r.from !== undefined) await putBack(session, r);
        await session.reopenAt(section);
      } catch (again) { r.notes.push(`and Settings could not be opened again: ${why(again)}`); return { results, kept, gates, broken: true }; }
    }
  }
  if (kept.length) {
    await session.reopenAt(section);
    await session.controls();
    const values = await session.values();
    for (const r of kept) {
      r.checks.reopen = same(values[r.id], r.to);
      if (!r.checks.reopen) { fail(r, 'reopen', `Settings opened again reads ${values[r.id] === undefined ? '(row gone)' : values[r.id]}`); await shoot(session, r, 'reopen', out); }
    }
  }
  return { results, kept, gates };
}
