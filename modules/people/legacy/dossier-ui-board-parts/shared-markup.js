/* NPC State Delta dossier surface: the small markup helpers the Board parts share (escape, tone variable, percent, signed number). */
import { escapeHtml } from '../../util/html.js';

// Tone keys → the --delta-* tokens the skins define. Anything else gets no tone, so a model value can never inject CSS.
const TONES = { good: 'var(--good, var(--delta-good))', bad: 'var(--bad, var(--delta-danger))', ten: 'var(--dsk-ten)', aff: 'var(--aff)', des: 'var(--des)', held: 'var(--held)' };
export const esc = value => escapeHtml(String(value ?? ''));
export const toneVar = key => TONES[key] || 'var(--delta-muted)';
export const percent = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
export const signed = value => `${value > 0 ? '+' : ''}${value}`;
