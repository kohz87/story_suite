// Story Director v2: the parts in their fixed order.

import { part as tracker } from '../../tracker/index.js';
import { part as time } from '../../time/index.js';
import { part as atlas } from '../../atlas/index.js';
import { part as chronicle } from '../../chronicle/index.js';
import { part as world } from '../../world/index.js';
import { part as keypeople } from '../../keypeople/index.js';
import { part as cast } from '../../cast/index.js';
import { part as names } from '../../names/index.js';
import { part as pulse } from '../../pulse/effects.js';
import { part as arc } from '../../arc/index.js';
import { part as checks } from '../../checks/index.js';
import { part as ripples } from '../../ripples/index.js';
import { part as screens } from '../../screens/index.js';


/** The parts in their fixed order: [id, part]. The order is the static prompt's and the tail's order. */
export const PARTS = Object.freeze([['tracker', tracker], ['time', time], ['atlas', atlas], ['chronicle', chronicle], ['world', world], ['keypeople', keypeople], ['cast', cast], ['names', names], ['pulse', pulse], ['arc', arc], ['checks', checks], ['ripples', ripples], ['screens', screens]]);
