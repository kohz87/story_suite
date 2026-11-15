// Source text of the dossier UI facade together with every part split out of it, for tests that pin source text.
// A part that is missing fails loudly; keep this list in step when more code moves out of dossier-ui.js.
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);

export const DOSSIER_UI_SOURCE_PARTS = [
    'dossier-ui-constants.js',
    'dossier-ui-model.js',
    'dossier-ui-catalog.js',
    'dossier-ui-html.js',
    'dossier-ui-relationship.js',
    'dossier-ui-meters.js',
    'dossier-ui-panel.js',
    'dossier-ui-controller.js',
    'dossier-ui-render.js',
    'dossier-ui-mount.js',
    'dossier-ui-styles.js',
    'dossier-ui-view-model.js',
    'dossier-ui-library.js',
    'dossier-ui-dial.js',
    'dossier-ui-board.js',
    'dossier-ui-sections.js',
    'dossier-ui-profile.js',
    'dossier-ui-screens.js',
    'dossier-ui-header.js',
    'dossier-ui-styles-board.js',
    'dossier-ui-styles-sections.js',
    'dossier-ui-parts/browser-start.js',
    'dossier-ui-parts/catalog-cast.js',
    'dossier-ui-parts/catalog-select.js',
    'dossier-ui-parts/controller.js',
    'dossier-ui-parts/html.js',
    'dossier-ui-parts/meters.js',
    'dossier-ui-parts/model-labels.js',
    'dossier-ui-parts/model-projection.js',
    'dossier-ui-parts/relationship.js',
];

const read = file => fs.readFileSync(new URL(file, root), 'utf8');

export function dossierUiSource() {
    return ['dossier-ui.js', ...DOSSIER_UI_SOURCE_PARTS].map(read).join('\n');
}
