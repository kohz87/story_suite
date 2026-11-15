// The small helpers the changes-lines parts share: the record test, list and short-words readers, and the line shape.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const list = value => (Array.isArray(value) ? value : []);
export const words = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 40) : '');
export const line = fields => ({ module: 'story-block', icon: 'fa-circle-info', text: '', summary: '', flag: '', note: '', kind: 'line', tone: 'info', check: null, ...fields });
