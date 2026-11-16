// Story Director v2: the parts in their fixed order.

import { part as tracker } from '../../../../../modules/time/tracker/index.js';
import { part as time } from '../../../../../modules/time/index.js';
import { part as atlas } from '../../../../../modules/atlas/atlas/index.js';
import { part as chronicle } from '../../../../../modules/world/chronicle/index.js';
import { part as world } from '../../../../../modules/world/world/index.js';
import { part as keypeople } from '../../../../../modules/cast/keypeople/index.js';
import { part as cast } from '../../../../../modules/cast/cast/index.js';
import { part as names } from '../../../../../modules/cast/names/index.js';
import { part as pulse } from '../../../../../modules/world/pulse/effects.js';
import { part as arc } from '../../../../../modules/arc/index.js';
import { part as checks } from '../../../../../packages/story-director/src/v2/checks/index.js';
import { part as ripples } from '../../../../../modules/world/ripples/index.js';
import { part as screens } from '../../screens/index.js';


/** The parts in their fixed order: [id, part]. The order is the static prompt's and the tail's order. */
export const PARTS = Object.freeze([['tracker', tracker], ['time', time], ['atlas', atlas], ['chronicle', chronicle], ['world', world], ['keypeople', keypeople], ['cast', cast], ['names', names], ['pulse', pulse], ['arc', arc], ['checks', checks], ['ripples', ripples], ['screens', screens]]);
