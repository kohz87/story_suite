/* NPC State Delta portrait actions: showing a generated portrait preview and turning its URL into a file. */
import { currentSessionIs, validatePortraitFile } from '../../legacy/dossier-tools-core.js';

export function generatedPreview(session, overlay, url) {
    if (!currentSessionIs(session)) return false;
    const value = String(url || '').trim();
    if (!value) return false;
    session.generatedPortraitUrl = value;
    const box = overlay?.querySelector?.('[data-generated-preview]');
    const image = overlay?.querySelector?.('[data-generated-image]');
    const placeholder = overlay?.querySelector?.('[data-generated-placeholder]');
    const use = overlay?.querySelector?.('[data-use-generated-portrait]');
    if (box) box.hidden = false;
    if (image) {
        image.src = value;
        image.hidden = false;
    }
    if (placeholder) placeholder.hidden = true;
    if (use) use.disabled = false;
    return true;
}

export async function generatedPortraitFile(url, npcId = 'npc') {
    const raw = String(url || '').trim();
    if (!raw) throw new Error('Generated image URL is empty.');
    const absolute = new URL(raw, globalThis.location?.href || 'http://localhost/').href;
    const response = await fetch(absolute, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Could not load generated image (${response.status}).`);
    const blob = await response.blob();
    if (!blob.type?.startsWith('image/') || blob.size > 16 * 1024 * 1024) throw new Error('Generated result must be an image no larger than 16 MB.');
    const validation = validatePortraitFile({ type: blob.type, size: blob.size });
    if (!validation.ok) throw new Error(validation.reason);
    const extension = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
    const safeId = String(npcId || 'npc').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'npc';
    return new File([blob], `${safeId}-generated.${extension}`, { type: blob.type });
}
