// Draws the "new view (preview)" checkbox row in SillyTavern's extension settings.

export const SWITCH_ID = 'story-suite-ui-next';

export function drawSwitch(doc, on, onToggle) {
  const host = doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings');
  if (!host || doc.getElementById(SWITCH_ID)) return null;
  const box = doc.createElement('input');
  box.type = 'checkbox';
  box.checked = on;
  box.addEventListener('change', () => onToggle(Boolean(box.checked)));
  const text = doc.createElement('span');
  text.textContent = 'Story Suite: new view (preview)';
  const label = doc.createElement('label');
  label.className = 'checkbox_label';
  label.appendChild(box);
  label.appendChild(text);
  const row = doc.createElement('div');
  row.id = SWITCH_ID;
  row.className = 'extension_container';
  row.appendChild(label);
  host.appendChild(row);
  return row;
}
