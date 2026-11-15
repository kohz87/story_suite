// The Export dialog's screen and the ids it and its widget go by.

import { RPG_STRINGS } from '../../strings.js';

const X = RPG_STRINGS.exp;
export const EXPORT_SCREEN_ID = 'story-block/export-character';
export const EXPORT_WIDGET = 'rpg.export';

/** The Export dialog's screen: one body, drawn by the export widget. */
export function createExportScreen() {
    return Object.freeze({
        id: EXPORT_SCREEN_ID, title: X.title, icon: 'fa-file-export', mounts: Object.freeze(['dialog']),
        template: `<ss-widget name="${EXPORT_WIDGET}"></ss-widget>`,
    });
}
