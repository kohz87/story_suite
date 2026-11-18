// Keeps the keyboard where it was when the wizard redraws a step: `draw` replaces the sheet's whole body, which would drop the focused tab, button or
// field. `markFocus(body, active)` notes which control had focus (as selectors tried in order, the control itself first, then its nearest stand-ins);
// `restoreFocus(body, marks, fallback)` focuses the first one that exists after the redraw (a disabled one is skipped).

const attr = (name, value) => `[${name}="${String(value).replace(/"/g, '\\"')}"]`;
const PAIRS = { next: ['back'], back: ['next'], 'import-pick': ['import-undo'], 'import-undo': ['import-pick'], 'replace-yes': ['add'], 'replace-keep': ['add'], create: ['done'] };

/** → the selectors (most exact first) for the control inside `body` that `active` is, or [] when focus is elsewhere. */
export function markFocus(body, active) {
  if (!active || !body?.contains?.(active) || active === body) return [];
  const data = active.dataset ?? {};
  const skill = active.closest?.('[data-skill]')?.dataset?.skill;
  const marks = [];
  if (active.closest?.('.wz-steps')) marks.push(`.wz-steps ${attr('data-value', data.value)}`);
  else if (skill !== undefined && (data.field || data.wiz)) marks.push(`${attr('data-skill', skill)} ${data.field ? attr('data-field', data.field) : attr('data-wiz', data.wiz)}`, attr('data-wiz', 'add'));
  else if (data.wiz) marks.push(`.wz-foot ${attr('data-wiz', data.wiz)}`, attr('data-wiz', data.wiz), ...(PAIRS[data.wiz] ?? []).flatMap(other => [`.wz-foot ${attr('data-wiz', other)}`, attr('data-wiz', other)]));
  else if (data.set) marks.push(attr('data-set', data.set));
  else if (data.plus) marks.push(attr('data-plus', data.plus), attr('data-minus', data.plus));
  else if (data.minus) marks.push(attr('data-minus', data.minus), attr('data-plus', data.minus));
  else if (data.field) marks.push(attr('data-field', data.field));
  return marks;
}

/** Focuses the first of `marks` found (and enabled) in `body`, else the `fallback` selector's; → whether something took focus. */
export function restoreFocus(body, marks, fallback = '.wz-steps [aria-selected="true"]') {
  for (const selector of [...marks, ...(marks.length ? [fallback] : [])]) {
    const node = body.querySelector(selector);
    if (node && node.disabled !== true && !node.hasAttribute?.('disabled')) { node.focus(); return true; }
  }
  return false;
}
