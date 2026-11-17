// The default screens in the order the game view should offer them (home first).

import { inventoryScreen } from '../inventory.js';
import { sceneScreen } from '../scene.js';
import { changesCardScreen } from '../changes-card.js';
import { homeScreen } from '../home.js';
import { inspectorScreen } from '../inspector.js';

/** The default screens, in the order the game view should offer them (home first). */
export const screens = Object.freeze([homeScreen, inventoryScreen, sceneScreen, changesCardScreen, inspectorScreen]);
