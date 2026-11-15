/* NPC State Delta dossier surface: the meter row, mood rows and pull row markup. */
import { esc } from './shared-markup.js';

// One meter row, the markup the With {{user}} meters use: the label, a bar from the centre (the middle is zero; `range` is the value at either end), the
// number, and, when it moved, the change as a small chip on the same line (`chip`: { text, good }). The mood rows reuse it.
export const signedText = value => (value > 0 ? '+' : value < 0 ? '−' : '') + (Number.isInteger(value) ? Math.abs(value) : Math.abs(value).toFixed(1));
export function meterRowHtml({ label, value, range, text = signedText(value), chip = null, cls = '', slot = false }) {
    const pct = Math.max(-50, Math.min(50, (value / range) * 50));
    return `<div class="delta-sheet-meter ${esc(cls)}${chip || slot ? ' delta-sheet-meter-chip' : ''}"><span>${esc(label)}</span><i class="delta-sheet-track" aria-hidden="true"><b style="left:${pct < 0 ? 50 + pct : 50}%;width:${Math.abs(pct)}%"></b></i><strong>${esc(text)}</strong>${chip ? `<em class="delta-sheet-chip" data-good="${chip.good ? 'yes' : 'no'}">${esc(chip.text)}</em>` : slot ? '<em class="delta-sheet-chip-slot" aria-hidden="true"></em>' : ''}</div>`;
}
// Feeling, Energy and Control as meter rows (the Mood tile and Right now): the value on the stored -3..+3 scale, each axis in its own colour, the change of the reply on show as the chip.
export const moodRowsHtml = mood => (mood?.rows?.length
    ? `<div class="delta-sheet-meters delta-mood-rows">${mood.rows.map(row => meterRowHtml({ label: row.label, value: row.value, range: 3, cls: `delta-mood-${row.tone}`, chip: row.change ? { text: signedText(row.change), good: row.change > 0 } : null, slot: true })).join('')}</div>` : '');

// The Pull as one line (the mockup's pull row): the instinct word, one to three dots for its strength (no ring), and the strength and cause in muted words.
// In the Mood tile it leads with the small PULL label; in the Mood section a PULL heading stands above it. Empty without a pull.
export function pullRowHtml(pull, { label = false } = {}) {
    if (!pull) return '';
    const level = Math.max(1, Math.min(3, Math.round(Number(pull.level) || 1)));
    const pips = `<span class="delta-pips" role="img" aria-label="strength ${level} of 3">${[1, 2, 3].map(n => `<i${n <= level ? ' class="on"' : ''}></i>`).join('')}</span>`;
    const words = [pull.note, pull.cause].filter(Boolean).map(esc).join(' · ');
    return `<div class="delta-pull-row">${label ? '<span class="delta-pull-k">Pull</span>' : ''}<b>${esc(pull.text)}</b>${pips}${words ? `<span class="delta-muted">${words}</span>` : ''}${pull.fresh ? ' <span class="delta-new-badge">New</span>' : ''}</div>`;
}
