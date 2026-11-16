/* NPC State Delta dossier surface: one Board tile as markup. */
import { esc, percent, toneVar } from './shared-markup.js';

// One tile. Fields (all optional except title): title, section, tone, wide, big, lines[], note, ring{value,text}.
// A tile without a section is not tappable.
export function boardTileHtml(tile = {}) {
    const head = `<span class="delta-tile-k" style="--c:${toneVar(tile.tone)}">${esc(tile.title)}${tile.section ? ' <span class="delta-tile-arrow">›</span>' : ''}</span>`;
    const raw = (Array.isArray(tile.lines) ? tile.lines.filter(Boolean) : []).map(String);
    // A lead (the toned bold start of the first line) joins that line with " · ", as the mockup's last-change tile reads;
    // any further line is the small muted one.
    const first = tile.lead ? [`<span><b class="delta-tile-lead" style="color:color-mix(in srgb, ${toneVar(tile.tone)} 72%, var(--delta-text))">${esc(tile.lead)}</b>${raw.length ? ` · ${esc(raw.shift())}` : ''}</span>`] : [];
    const lines = [...first, ...raw.map(line => `<span${tile.lead || tile.small ? ' class="delta-tile-small"' : ''}>${esc(line)}</span>`)];
    const body = [
        tile.big ? `<span class="delta-tile-big${tile.bigClass ? ` ${tile.bigClass}` : ''}">${esc(tile.big)}</span>` : '',
        tile.faces || '',
        tile.rowsHtml || '',
        tile.footHtml || '',
        tile.dots?.length ? `<span class="delta-tile-dots">${tile.dots.map(kind => `<i class="delta-dot-${/^(mem|lie|know)$/.test(kind) ? kind : 'mem'}"></i>`).join('')}</span>` : '',
        ...lines,
        tile.ring ? `<span class="delta-tile-row"><span class="delta-tile-ring" style="--v:${percent(tile.ring.value)}"><span>${esc(tile.ring.text)}</span></span>${tile.note ? `<span class="delta-muted">${esc(tile.note)}</span>` : ''}</span>` : (tile.note ? `<span class="delta-muted">${esc(tile.note)}</span>` : ''),
    ].join('');
    const classes = `delta-tile${tile.wide ? ' delta-tile-wide' : ''}`;
    if (tile.section) {
        return `<button type="button" class="${classes}" data-delta-screen="section" data-delta-section="${esc(tile.section)}">${head}${body}</button>`;
    }
    return `<div class="${classes}">${head}${body}</div>`;
}
