// The visible effects the settings walk checks after a change, for the rows that have one (Look, Panel background, the RPG switch, Calendar, a module switch).

const LOOK_ROWS = new Set(['host.panelStyle', 'host.glassStrength', 'host.font', 'host.textSize']);
const CUSTOM_ONLY = ['world.era', 'world.months', 'world.weekdays', 'world.leapYears'];
const RPG_SWITCH = /^sub:story-block:story-block\.rpg$/;

const on = value => value === true || value === 'true';
const parse = text => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };

// Turning a module off should grey its own Settings page (its rows can no longer be changed).
async function moduleGreys(session, control, ctx) {
  const target = await session.page.evaluate((mod) => {
    const card = document.querySelector(`.sov:not([hidden]) .spage .mod[data-mod="${mod}"]`);
    return card?.querySelector('.lnk[data-sec]')?.dataset.sec ?? null;
  }, control.id.slice(4));
  if (!target) return { name: 'module page greys', pass: null, note: 'no Settings › link on the card' };
  if (!(await session.sections()).includes(target)) return { name: 'module page greys', pass: false, note: `the card's Settings › link goes to "${target}", which is not a Settings page` };
  await session.gotoSection(target);
  const rows = (await session.controls()).filter(c => c.kind !== 'act' && !c.id.startsWith('mod:') && !c.id.startsWith('sub:'));
  const live = rows.filter(c => !c.disabled).map(c => c.id);
  await session.gotoSection(ctx.section);
  await session.controls();
  if (!rows.length) return { name: 'module page greys', pass: true, note: `${target}: no rows left` };
  return { name: 'module page greys', pass: live.length === 0, note: live.length ? `${target}: ${live.length} of ${rows.length} rows still editable (${live.slice(0, 3).join(', ')}${live.length > 3 ? ', …' : ''})` : `${target}: all ${rows.length} rows greyed` };
}

/**
 * Checks the visible effect of the change just made, when the row has one. `ctx` = { section, from, to, look0, look1, idsBefore, idsAfter }.
 * Returns `{ name, pass, note }` (pass null when the check could not run), or null when the row has no visible effect to check.
 */
export async function checkEffect(session, control, ctx) {
  const { id } = control;
  if (LOOK_ROWS.has(id)) {
    const pass = ctx.look0 !== ctx.look1;
    return { name: 'suite look changes', pass, note: pass ? 'computed style or attributes changed' : 'nothing on the suite view changed (style, fonts, blur, attributes)' };
  }
  if (id === 'look.panelBg') {
    const want = on(ctx.to) ? 'on' : 'off';
    const got = parse(ctx.look1)?.attrs?.['data-panelbg'] ?? '(none)';
    return { name: 'suite data-panelbg', pass: got === want, note: `data-panelbg=${got}, wanted ${want}` };
  }
  if (id === 'world.calendar') {
    const custom = ctx.to === 'Custom';
    const shown = CUSTOM_ONLY.filter(k => ctx.idsAfter.includes(k));
    const pass = custom ? shown.length === CUSTOM_ONLY.length : shown.length === 0;
    return { name: 'Custom-only rows follow Calendar', pass, note: `Calendar ${ctx.to}: ${shown.length ? shown.join(', ') : 'no Custom rows'} shown` };
  }
  if (RPG_SWITCH.test(id)) {
    // The tab strip follows at once; the Settings page list is built when Settings opens, so it is read from a fresh one.
    const party = await session.page.evaluate(() => [...document.querySelectorAll('.su-strip button, .su-bar button')].some(b => /party/i.test(b.textContent)));
    await session.closeSettings();
    await session.openSettings();
    const seen = { party, section: (await session.sections()).includes('rpg') };
    await session.gotoSection(ctx.section);
    await session.controls();
    const want = on(ctx.to);
    const pass = seen.section === want && seen.party === want;
    return { name: 'RPG page and Party tab follow the switch', pass, note: `RPG ${want ? 'on' : 'off'}: Settings › RPG ${seen.section ? 'shown' : 'hidden'}, Party tab ${seen.party ? 'shown' : 'hidden'}` };
  }
  if (id.startsWith('mod:') && !on(ctx.to)) return moduleGreys(session, control, ctx);
  return null;
}
