// Touches SillyTavern's page: finds message elements, adds the Extensions-menu entry, fills the input, and keeps prefs in chat metadata.

const PREFS_KEY = 'storySuiteUiPrefs';
const MENU_ID = 'story-suite-ui-menu';

/** Returns the `.mes` element of reply `index` (ST's mesid), or null. */
export function messageElement(doc, index) {
  if (!doc || !Number.isInteger(index) || index < 0) return null;
  return doc.querySelector(`.mes[mesid="${index}"]`) ?? null;
}

/** Adds one entry to ST's #extensionsMenu once; returns the item, or null when the menu is missing or already has it. */
export function addMenuEntry(doc, { label, onClick, id = MENU_ID } = {}) {
  const host = doc?.querySelector('#extensionsMenu');
  if (!host || !label || doc.querySelector(`#${id}`)) return null;
  const item = doc.createElement('div');
  item.id = id;
  item.className = 'list-group-item flex-container flexGap5 interactable';
  item.setAttribute('tabindex', '0');
  const icon = doc.createElement('div');
  icon.className = 'fa-solid fa-sliders extensionsMenuExtensionButton';
  const text = doc.createElement('span');
  text.textContent = String(label);
  item.appendChild(icon);
  item.appendChild(text);
  item.addEventListener('click', () => onClick?.());
  host.appendChild(item);
  return item;
}

/** Puts text in ST's message box (never sends it) and tells the page the value changed; returns whether the box was found. */
export function fillInput(doc, text) {
  const box = doc?.querySelector('#send_textarea');
  if (!box) return false;
  box.value = String(text ?? '');
  if (typeof box.dispatchEvent === 'function' && typeof Event === 'function') box.dispatchEvent(new Event('input', { bubbles: true }));
  else box.dispatch?.('input');
  box.focus?.();
  return true;
}

function liveMeta(ctx) {
  try {
    const c = typeof ctx === 'function' ? ctx() : ctx;
    return c?.chatMetadata && typeof c.chatMetadata === 'object' ? c : null;
  } catch {
    return null;
  }
}

/** Reads and writes this chat's view prefs in its metadata: `{ get(): object, set(key, value): boolean }`; ctx may be a function (the live context). */
export function chatPrefs(ctx) {
  return {
    get() {
      const c = liveMeta(ctx);
      const saved = c?.chatMetadata[PREFS_KEY];
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...saved } : {};
    },
    set(key, value) {
      const c = liveMeta(ctx);
      if (!c || typeof key !== 'string' || !key) return false;
      const now = c.chatMetadata[PREFS_KEY];
      c.chatMetadata[PREFS_KEY] = { ...(now && typeof now === 'object' ? now : {}), [key]: value };
      try { (c.saveMetadataDebounced ?? c.saveMetadata)?.call(c); } catch { /* the choice lasts this page only */ }
      return true;
    },
  };
}
