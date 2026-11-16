// The small builders every RPG block template uses for its fields and expressions.
import { CREATION } from '../names.js';

export const text = (label, max = CREATION.skillName) => ({ type: 'text', max, default: '', label });
export const int = (label, min, max, value, extra = {}) => ({ type: 'int', min, max, default: value, label, ...extra });
export const range = (min, max) => ({ type: 'int', min, max });
export const get = field => ['get', [field]];
