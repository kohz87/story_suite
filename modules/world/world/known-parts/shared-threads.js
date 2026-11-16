// Story Director v2, world: reads the Director's threads from state and tells which one the arc planner made.

import { isRecord } from './shared-text.js';

export const threadsOf = state => (isRecord(state?.domains?.director?.threads) ? Object.values(state.domains.director.threads).filter(isRecord) : []);

export const planned = thread => Boolean(thread?.track?.arc);
