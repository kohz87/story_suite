// The Story Suite drawer in SillyTavern's Extensions panel: its title, a status line (version and modules) and the view's two buttons,
// Settings (the view's overlay) and Open Story Suite. NPC State's own settings section goes into the same drawer (it moves in when it mounted first).

export const DRAWER_ROW_ID = 'story-suite-next-drawer';
export const DRAWER_ID = 'story_suite_v2_drawer';
const NPC_SETTINGS_ID = 'people_settings';

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(doc, icon, label, onClick) {
  const node = el(doc, 'button', 'menu_button');
  node.type = 'button';
  node.title = label;
  node.setAttribute('aria-label', label);
  const glyph = el(doc, 'i', `fa-solid ${icon}`);
  glyph.setAttribute('aria-hidden', 'true');
  node.append(glyph, el(doc, 'span', '', label));
  node.addEventListener('click', onClick);
  return node;
}

/** The drawer, made once SillyTavern's extension settings are on the page (null before). `title` is its header text. */
function drawer(doc, title) {
  const found = doc.getElementById(DRAWER_ID);
  if (found) return found;
  const host = doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings');
  if (!host) return null;
  const root = el(doc, 'div', 'inline-drawer story-suite-drawer');
  root.id = DRAWER_ID;
  const toggle = el(doc, 'div', 'inline-drawer-toggle inline-drawer-header');
  toggle.append(el(doc, 'b', '', title), el(doc, 'div', 'inline-drawer-icon fa-solid fa-circle-chevron-down down'));
  const content = el(doc, 'div', 'inline-drawer-content');
  content.appendChild(el(doc, 'p', 'story-suite-muted story-suite-drawer-status'));
  root.append(toggle, content);
  host.appendChild(root);
  const npc = doc.getElementById(NPC_SETTINGS_ID);
  if (npc) content.appendChild(npc);
  return root;
}

/**
 * Draws the drawer and its button row once (call it again on each refresh: only the status line changes). `title` and `status` are its
 * header and status texts. Returns the row, or null while there is no extension settings panel yet.
 */
export function addDrawerButtons(doc, { onSettings, onOpen, title = 'Story Suite', status = '' }) {
  const root = drawer(doc, title);
  if (!root) return null;
  const content = root.querySelector('.inline-drawer-content');
  const line = content.querySelector('.story-suite-drawer-status');
  if (line && line.textContent !== status) line.textContent = status;
  const had = doc.getElementById(DRAWER_ROW_ID);
  if (had) return had;
  const row = el(doc, 'div', 'story-suite-drawer-buttons');
  row.id = DRAWER_ROW_ID;
  row.append(button(doc, 'fa-sliders', 'Settings', onSettings), button(doc, 'fa-book-open', 'Open Story Suite', onOpen));
  content.insertBefore(row, line?.nextElementSibling ?? null);
  return row;
}
