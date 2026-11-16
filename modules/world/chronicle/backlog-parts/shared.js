// Story Director v2, chronicle part: shared record and list normalization helpers for backlog modules.

import { flat } from '../days/shared.js';

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const list = value => (Array.isArray(value) ? value.map(flat).filter(Boolean) : []);
