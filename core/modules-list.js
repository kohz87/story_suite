// The built-in modules after the core one, in the order they register (boot.js reads this list; one job: the order).
// The core module (scene, inventory, data modules, RPG) is registered inside createRuntime. People goes last.

import { storyDirectorModule } from '../ui/legacy/director/module.js';

/** The ordered list of built-in modules boot registers with registerIsolated. */
export const BUILTIN_MODULES = Object.freeze([storyDirectorModule]);
