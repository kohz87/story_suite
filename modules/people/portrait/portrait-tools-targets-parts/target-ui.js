/* NPC State Delta portrait target UI: the upload input, generation availability and the form selector markup. */
import { api, escapeHtml } from '../dossier-tools-core.js';
import { npcForms } from './target-resolve.js';

export function hiddenUploadInput(npcId) {
    return `<input type="file" class="npc-state-delta-inline-portrait-file delta-tools-portrait-file" data-npc-id="${escapeHtml(npcId)}" accept="image/*">`;
}

export function portraitGenerationAvailable() {
    const runtime = api();
    if (typeof runtime?.generatePortraitUrl !== 'function') return false;
    try { return runtime?.portraitSettings?.()?.portraitGenerationEnabled !== false; }
    catch { return true; }
}

export function portraitTargetHtml(npc, form) {
    const forms = npcForms(npc);
    if (!forms.length) return '';
    const options = [['', 'Main portrait'], ...forms.map(name => [name, `${name} form`])]
        .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === form ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
    return `<label class="delta-tools-portrait-target">Portrait for<select data-portrait-target>${options}</select></label>`;
}
