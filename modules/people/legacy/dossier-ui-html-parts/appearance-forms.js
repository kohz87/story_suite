/* NPC State Delta dossier surface: the appearance forms disclosure with its per-form portraits. */
import { escapeHtml } from '../src/util/html.js';
import { imageSourceAttribute } from './portrait-refs.js';
import { proseHtml } from './prose.js';

export function appearanceFormsHtml(npc, { portraitRefs = null } = {}) {
    const model = npc.appearanceModel;
    const presentation = npc.currentPresentation || '';
    const compatibilityCurrent = !model.currentForm && !model.currentFormUnknown && presentation
        ? `<div class="delta-appearance-form-row"><b>Current outfit &amp; presentation<span class="delta-appearance-current-badge">Current</span></b>${proseHtml(presentation)}</div>`
        : '';
    const current = model.currentFormUnknown ? 'Unclassified / unknown'
        : model.currentForm || (compatibilityCurrent ? 'Current presentation' : 'No selected form');
    const unclassified = model.currentFormUnknown && model.unclassifiedAppearance
        ? `<div class="delta-appearance-form-row"><b>Current unclassified presentation<span class="delta-appearance-current-badge">Current</span></b>${proseHtml(model.unclassifiedAppearance)}</div>`
        : '';
    const formImages = npc.formPortraits || {};
    const rows = model.appearanceForms.map(form => {
        const image = formImages[form.name] || '';
        const thumb = image
            ? `<img class="delta-form-portrait-thumb" ${imageSourceAttribute(image, portraitRefs)} alt=""${escapeHtml(form.name)} form portrait" loading="lazy" decoding="async">`
            : '<span class="delta-form-portrait-thumb delta-form-portrait-empty" aria-hidden="true">+</span>';
        const action = npc.id ? `<button type="button" class="delta-btn delta-experience-portrait delta-form-portrait-button" data-npc-id="${escapeHtml(npc.id)}" data-form="${escapeHtml(form.name)}">${image ? 'Change portrait' : 'Add portrait'}</button>` : '';
        return `<div class="delta-appearance-form-row delta-appearance-form-with-portrait">${thumb}<div><b>${escapeHtml(form.name)}${form.name === model.currentForm ? '<span class="delta-appearance-current-badge">Current</span>' : ''}</b>${proseHtml(form.appearance)}${action}</div></div>`;
    }).join('');
    const empty = !unclassified && !compatibilityCurrent && !rows ? '<p class="delta-muted">No named forms established.</p>' : '';
    return `<details class="delta-appearance-form-summary" data-delta-key="appearance" open><summary><b>Appearance</b><small>Current: ${escapeHtml(current)}</small></summary><div class="delta-appearance-form-list">${model.overallAppearance && !(model.appearanceForms.length && (model.currentForm || model.currentFormUnknown)) ? `<div class="delta-appearance-form-row"><b>Physical features</b>${proseHtml(model.overallAppearance)}</div>` : ''}${unclassified}${compatibilityCurrent}${rows}${empty}</div></details>`;
}
