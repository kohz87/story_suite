// The settings walk's readers that run inside the SillyTavern page (through page.evaluate): each function is self-contained.

/**
 * Tags every control on the open Settings page with `data-walk-id` and returns them in page order:
 * `{ id, kind, label, disabled, visible, options? }`; kind is sw, seg, sel, num, txt (a text box or text area), chips, or act for an action button.
 */
export function listControls() {
  const page = document.querySelector('.sov:not([hidden]) .spage');
  if (!page) return [];
  const clean = text => String(text ?? '').trim().replace(/\s+/g, ' ');
  const labelOf = (el) => {
    const row = el.closest('.srow');
    const title = row?.querySelector('.lb b .ln') ?? row?.querySelector('.lb b');
    return clean(el.getAttribute('aria-label') || title?.textContent || el.closest('.mod')?.querySelector('.mt b')?.textContent || el.textContent);
  };
  const idOf = (el, kind) => {
    if (el.dataset.mod) return `mod:${el.dataset.mod}`;
    if (el.dataset.sub) return `sub:${el.dataset.sub}`;
    const row = el.closest('.srow[data-key]');
    if (row && kind !== 'act') return row.dataset.type === 'multi' ? `${row.dataset.key}:${clean(el.getAttribute('aria-label')).split(': ').pop()}` : row.dataset.key;
    const conn = el.closest('.conn > *');
    if (conn) return `${kind === 'act' ? 'act' : 'conn'}:${clean(conn.querySelector('b')?.textContent)}${kind === 'act' ? `:${clean(el.textContent)}` : ''}`;
    if (kind === 'act') return `act:${clean(el.textContent) || labelOf(el)}`;
    if (el.closest('.srow')) return `row:${labelOf(el)}`;
    return `ctl:${labelOf(el)}`;
  };
  const kindOf = (el) => {
    if (el.matches('button.sw[role=switch]')) return 'sw';
    if (el.matches('.seg')) return 'seg';
    if (el.matches('select')) return 'sel';
    if (el.matches('input[type=number]')) return 'num';
    if (el.matches('input[type=text], textarea')) return 'txt';
    if (el.matches('.chips3')) return 'chips';
    if (el.matches('button') && !el.closest('.seg, .chips3') && !el.matches('.sback')) return 'act';
    return null;
  };
  const seen = new Map();
  const out = [];
  for (const el of page.querySelectorAll('button, select, input, textarea, .seg, .chips3')) {
    const kind = kindOf(el);
    if (!kind) continue;
    let id = idOf(el, kind);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}#${n + 1}`;
    el.setAttribute('data-walk-id', id);
    const options = kind === 'seg' ? [...el.querySelectorAll('button')].map(b => b.dataset.value)
      : kind === 'sel' ? [...el.options].map(o => o.value)
        : kind === 'chips' ? [...el.querySelectorAll('button')].map(b => clean(b.textContent)) : undefined;
    // A number's step: the input's own, or the one its hint states ("50 to 300, in steps of 25").
    const step = kind === 'num' ? Number(el.getAttribute('step')) || Number(/steps? of (\d+)/.exec(el.closest('.srow')?.querySelector('.lb small')?.textContent ?? '')?.[1]) || 1 : undefined;
    const disabled = el.disabled === true || el.hasAttribute('disabled') || Boolean(el.closest('.dis'));
    out.push({ id, kind, label: kind === 'act' ? clean(el.textContent) || labelOf(el) : labelOf(el), disabled, visible: el.getClientRects().length > 0, ...(options ? { options } : {}), ...(step ? { step } : {}) });
  }
  return out;
}

/** The value each tagged control shows now, by walk id (switches as booleans, the rest as text; chips as "a, b"). */
export function readValues() {
  const values = {};
  for (const el of document.querySelectorAll('.sov:not([hidden]) .spage [data-walk-id]')) {
    let value = null;
    if (el.matches('button.sw')) value = el.getAttribute('aria-checked') === 'true';
    else if (el.matches('.seg')) value = el.querySelector('button[aria-pressed=true], button[aria-selected=true]')?.dataset.value ?? null;
    else if (el.matches('.chips3')) value = [...el.querySelectorAll('button[aria-pressed=true]')].map(b => b.textContent.trim()).join(', ');
    else if (el.matches('select, input, textarea')) value = el.value;
    else continue;
    values[el.dataset.walkId] = value;
  }
  return values;
}

/** A print of how the suite looks (root attributes and the computed type, panel and blur styles), as JSON; null when the suite is not on the page. */
export function lookPrint() {
  const root = document.querySelector('.su-root');
  if (!root) return null;
  const css = (el, names) => (el ? Object.fromEntries(names.map(n => [n, getComputedStyle(el)[n]])) : null);
  const attrs = Object.fromEntries([...root.attributes].filter(a => a.name !== 'inert').map(a => [a.name, a.value]));
  return JSON.stringify({
    attrs,
    zoom: getComputedStyle(document.documentElement).getPropertyValue('--ss-zoom'),
    root: css(root, ['fontFamily', 'fontSize', 'zoom']),
    panel: css(root.querySelector('.sov .glass'), ['backgroundColor', 'backdropFilter', 'fontFamily', 'fontSize']),
    text: css(root.querySelector('.sov .spage h2, .sov .spage .lb b'), ['fontFamily', 'fontSize']),
    bar: css(root.querySelector('.su-bar'), ['backgroundColor', 'backdropFilter']),
    back: css(root.querySelector('.su-back'), ['display', 'opacity', 'backgroundImage']),
  });
}

/** What the page keeps for the suite: its SillyTavern extension settings (not the old view's copy), this chat's metadata and the suite's device keys in localStorage. */
export function storeSnapshot() {
  const ctx = globalThis.SillyTavern?.getContext?.();
  const device = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (/story|suite/i.test(key)) device[key] = localStorage.getItem(key);
  }
  const settings = Object.fromEntries(Object.entries(ctx?.extensionSettings ?? {}).filter(([key]) => /^(storySuite|storyBlock|storyDirector|npc_state_delta)$/.test(key)));
  return JSON.parse(JSON.stringify({ settings, chat: ctx?.chatMetadata ?? null, device }));
}
