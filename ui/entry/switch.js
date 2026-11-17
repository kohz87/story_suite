// Draws the way back to the new view in SillyTavern's extension settings: one "Use the old view" row, drawn only while this device uses the old view.

export const SWITCH_ID = 'story-suite-old-view';

/** Draws the row (ticked) once; unticking it calls `onToggle(false)`. Returns the row, or null when there is no host or it is already drawn. */
export function drawSwitch(doc, on, onToggle) {
  const host = doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings');
  if (!host || doc.getElementById(SWITCH_ID)) return null;
  const box = doc.createElement('input');
  box.type = 'checkbox';
  box.checked = on;
  box.addEventListener('change', () => onToggle(Boolean(box.checked)));
  const text = doc.createElement('span');
  text.textContent = 'Story Suite: use the old view (untick for the new view)';
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
