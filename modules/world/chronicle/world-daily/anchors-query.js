// World events: `chronicle.world.anchors`, the anchors the world has recorded so far (`fired:x`, `set:x`, `fact:x`, `learned:cast/secret`, ...), as a sorted
// list of keys, for NPC State to read a pack secret's gate against. Read from the stored state each time (nothing is kept); [] while the switch is off.
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { setup } from '../queries-parts/env.js';
import { knownAnchors } from './learned.js';
import { unheldFacts } from './holding-facts.js';
import { toolsQuery } from '../queries-parts/shared-ask.js';

/** The query (feature-tagged: null while the switch is off). */
export const anchorsQuery = Object.assign((state, _args, tools) => [...knownAnchors(setup(state, tools).chronicle, unheldFacts(toolsQuery(tools)))].sort(), { feature: WORLD_EVENTS_FEATURE });
