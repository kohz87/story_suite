// Source text of the dossier UI facade together with every part split out of it, for tests that pin source text.
// A part that is missing fails loudly; keep this list in step when more code moves out of dossier-ui.js.
import fs from 'node:fs';
import { oldUrl } from './old-path.js';


export const DOSSIER_UI_SOURCE_PARTS = [
    'dossier-ui-constants.js',
    'dossier-ui-constants-parts/ids.js',
    'dossier-ui-constants-parts/observer-timing.js',
    'dossier-ui-constants-parts/refresh-timing.js',
    'dossier-ui-model.js',
    'dossier-ui-model-parts/change-projections.js',
    'dossier-ui-model-parts/change-stamps.js',
    'dossier-ui-model-parts/detail-projection.js',
    'dossier-ui-model-parts/index-projection.js',
    'dossier-ui-model-parts/portrait-source.js',
    'dossier-ui-model-parts/values.js',
    'dossier-ui-catalog.js',
    'dossier-ui-html.js',
    'dossier-ui-html-parts/appearance-forms.js',
    'dossier-ui-html-parts/cards.js',
    'dossier-ui-html-parts/change-marks.js',
    'dossier-ui-html-parts/dom-helpers.js',
    'dossier-ui-html-parts/identity-text.js',
    'dossier-ui-html-parts/portrait-markup.js',
    'dossier-ui-html-parts/portrait-refs.js',
    'dossier-ui-html-parts/prose.js',
    'dossier-ui-relationship.js',
    'dossier-ui-meters.js',
    'dossier-ui-panel.js',
    'dossier-ui-controller.js',
    'dossier-ui-render.js',
    'dossier-ui-mount.js',
    'dossier-ui-styles.js',
    'dossier-ui-view-model.js',
    'dossier-ui-library.js',
    'dossier-ui-library-parts/face-ring.js',
    'dossier-ui-library-parts/faces.js',
    'dossier-ui-library-parts/foot.js',
    'dossier-ui-library-parts/rows.js',
    'dossier-ui-dial.js',
    'dossier-ui-board.js',
    'dossier-ui-sections.js',
    'dossier-ui-profile.js',
    'dossier-ui-screens.js',
    'dossier-ui-header.js',
    'dossier-ui-styles-board.js',
    'dossier-ui-styles-sections.js',
    // The parts of the Board and catalog facades.
    'dossier-ui-board-parts/shared-markup.js',
    'dossier-ui-board-parts/meter-rows.js',
    'dossier-ui-board-parts/tile.js',
    'dossier-ui-board-parts/tiles.js',
    'dossier-ui-board-parts/screen.js',
    'dossier-ui-catalog-parts/index-order.js',
    'dossier-ui-catalog-parts/key-projection.js',
    'dossier-ui-catalog-parts/cast-projection.js',
    'dossier-ui-catalog-parts/state-projection.js',
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

const read = file => fs.readFileSync(oldUrl(file), 'utf8');

// Files whose code moved into a sibling "<name>-parts/" folder (the file itself is now a facade of re-exports).
const SPLIT_PARTS = ['dossier-ui-relationship', 'dossier-ui-screens', 'dossier-ui-sections', 'dossier-ui-view-model']
    .flatMap(name => fs.readdirSync(oldUrl(`${name}-parts/`)).filter(file => file.endsWith('.js')).sort().map(file => `${name}-parts/${file}`));

export function dossierUiSource() {
    return ['dossier-ui.js', ...DOSSIER_UI_SOURCE_PARTS, ...SPLIT_PARTS].map(read).join('\n');
}
