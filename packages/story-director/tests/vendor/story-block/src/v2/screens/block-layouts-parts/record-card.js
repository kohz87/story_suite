// Draws a record of fields as one card of label and value lines.
import { h } from '../../view/widgets/dom.js';
import { dmNameOf } from '../../data-modules/schema.js';
import { chip, pencilFor, editorProps } from './shared-chrome.js';

// ---- a record of fields ------------------------------------------------------------------------------------------------------------------

/** lines: [{ field, label, schema, value, tones?, unit? }]; a choice is a chip when it has tones, else a pill; the pencil edits the field. `tiles`: the lines as small tiles in one row, no pencils. */
export function drawRecordCard(env, parent, { title, lines, module, who, tiles = false }) {
    const { doc } = env;
    const section = h(doc, 'section', 'ss-b-recsec ss-l-root'); parent.appendChild(section);
    if (title) section.appendChild(h(doc, 'h4', 'ss-section-label', title));
    const dl = h(doc, 'dl', `ss-glass ss-b-card${tiles ? ' ss-rm-tiles' : ''}`); section.appendChild(dl);
    for (const line of lines) {
        const row = h(doc, 'div', 'ss-b-line'); dl.appendChild(row);
        row.setAttribute('data-field', line.field);
        row.appendChild(h(doc, 'dt', '', line.label));
        const dd = h(doc, 'dd', ''); row.appendChild(dd);
        const { schema, value } = line;
        if (schema.type === 'enum') {
            const tone = line.tones?.[value];
            // As a tile a choice is a plain word (an amber one for a warn tone) and a short code like a rank letter a round badge: no pill.
            if (tiles) dd.appendChild(h(doc, 'span', tone === 'warn' ? 'ss-rm-warn' : schema.values.every(item => String(item).length <= 2) ? 'ss-rm-badge' : '', String(value)));
            else if (tone) dd.appendChild(chip(doc, String(value), tone));
            else dd.appendChild(h(doc, 'span', 'ss-pill ss-pill-soft', String(value)));
        } else if (schema.type === 'bool') dd.textContent = value ? 'Yes' : 'No';
        else if (schema.type === 'int') dd.textContent = [dmNameOf(schema, value) ?? String(value), line.unit].filter(Boolean).join(' ');
        else dd.textContent = String(value ?? '');
        if (tiles) continue;   // (a tile has no pencil; the block's own Edit changes the field)
        const edit = h(doc, 'dd', 'ss-b-pen-cell'); row.appendChild(edit);
        if (schema.edit !== false) pencilFor(env, edit, editorProps(module, line.field, null, schema, line.label, who), { module, field: line.field, key: '', who: who ?? '' });
    }
    return section;
}
