// One meter's value on an entry.
import { isInt } from '../npc-meters-config.js';

/** One meter's value on an entry (its start value when the entry has none yet). */
export const meterValue = (record, def) => (isInt(record?.meters?.[def.id]) ? record.meters[def.id] : def.start);
