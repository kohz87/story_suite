// Small readers the gear parts share: an object test, a guarded query, and a stat bonus map held to the known stats.
import { STATS } from '../names.js';

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const ask = (query, name, args) => { try { return query(name, args) ?? null; } catch { return null; } };

export const lower = stats => Object.fromEntries(Object.entries(isObject(stats) ? stats : {}).filter(([stat, n]) => STATS.includes(stat.toLowerCase()) && Number.isSafeInteger(n) && n !== 0).map(([stat, n]) => [stat.toLowerCase(), n]));
