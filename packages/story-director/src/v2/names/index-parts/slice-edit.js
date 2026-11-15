// Story Director v2, names: editing the stored tables: a JSON pointer key and dropping the oldest entries.

export const jsonKey = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
export const oldest = (table, keep) => { for (const key of Object.keys(table).slice(0, Math.max(0, Object.keys(table).length - keep))) delete table[key]; };
