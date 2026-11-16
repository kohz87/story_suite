import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeSource } from './helpers/runtime-source.js';
import { dossierUiSource } from './helpers/dossier-ui-source.js';
import { styleSource } from './helpers/shipped-modules.js';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const index = runtimeSource();
export const continuityUi = fs.readFileSync(path.join(root, 'continuity-ui.js'), 'utf8');
export const css = styleSource();
export const dossierUi = dossierUiSource();
