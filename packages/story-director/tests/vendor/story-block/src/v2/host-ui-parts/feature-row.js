// The settings host's feature switch: one feature's row (switch, label, description, prompt hint) and the id of its switch.

import { PROMPT_HINT } from '../features.js';
import { el } from '../host-ui/controls.js';

// One feature's row: its switch, label, description and (when it changes the static prompt) the hint.
// A feature is drawn twice, so each switch's id is its place (`overview` or `module`) plus the feature id
// encoded whole (encodeURIComponent never makes two ids one, as flattening "a.b_c" and "a.b.c" would);
// its row labels that switch.
export const featureInputId = (place, id) => `story_suite_feature_${place}_${encodeURIComponent(String(id))}`;
export function featureRow(doc, feature, onChange, place) {
    const id = featureInputId(place, feature.id);
    const row = el(doc, 'label', 'story-suite-row story-suite-feature');
    row.dataset.feature = feature.id;
    row.dataset.type = 'bool';
    row.setAttribute('for', id);
    const text = el(doc, 'span', 'story-suite-row-label');
    text.appendChild(el(doc, 'b', '', feature.label));
    if (feature.describe) text.appendChild(el(doc, 'small', '', feature.describe));
    if (feature.prompt) text.appendChild(el(doc, 'small', 'story-suite-feature-hint', PROMPT_HINT));
    // A feature whose `needs` no module meets: shown off, not switchable, with the reason.
    const unavailable = feature.available === false;
    if (unavailable) {
        row.classList.add('story-suite-feature-unavailable');
        text.appendChild(el(doc, 'small', 'story-suite-feature-why', feature.why));
    }
    row.appendChild(text);
    const input = el(doc, 'input');
    input.type = 'checkbox';
    input.id = id;
    input.setAttribute('role', 'switch');
    input.checked = feature.on === true && !unavailable;
    input.disabled = unavailable;
    input.setAttribute('aria-checked', String(input.checked));
    if (unavailable) input.setAttribute('aria-disabled', 'true');
    input.addEventListener('change', () => onChange(Boolean(input.checked)));
    row.appendChild(input);
    return row;
}
