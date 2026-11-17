// The new view's two buttons in the Story Suite drawer of SillyTavern's Extensions panel: Settings (the new view's overlay) and Open Story Suite.

export const DRAWER_ROW_ID = 'story-suite-next-drawer';
const DRAWER_CONTENT = '#story_suite_v2_drawer .inline-drawer-content';

function button(doc, icon, label, onClick) {
  const node = doc.createElement('button');
  node.type = 'button';
  node.className = 'menu_button';
  node.title = label;
  node.setAttribute('aria-label', label);
  const glyph = doc.createElement('i');
  glyph.className = `fa-solid ${icon}`;
  glyph.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('span');
  text.textContent = label;
  node.append(glyph, text);
  node.addEventListener('click', onClick);
  return node;
}

/** Adds the row once the drawer is on the page (call it again on each refresh; it is drawn once). Returns the row, or null when there is no drawer or the row is there. */
export function addDrawerButtons(doc, { onSettings, onOpen }) {
  const content = doc.querySelector(DRAWER_CONTENT);
  if (!content || doc.querySelector(`#${DRAWER_ROW_ID}`)) return null;
  const row = doc.createElement('div');
  row.id = DRAWER_ROW_ID;
  row.className = 'story-suite-drawer-buttons';
  row.append(button(doc, 'fa-sliders', 'Settings', onSettings), button(doc, 'fa-book-open', 'Open Story Suite', onOpen));
  const first = content.firstElementChild?.nextElementSibling ?? null;   // after the status line, where the old buttons were
  content.insertBefore(row, first);
  return row;
}
