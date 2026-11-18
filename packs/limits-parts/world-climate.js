// Pack format 4, the world pack's extra fields: the climate list, the region fields with `climate`, the start fields and the hints for retired cast fields.

export const CLIMATES = Object.freeze(['temperate', 'cold', 'frozen', 'highland', 'arid', 'warm', 'tropical', 'coastal', 'sea', 'underground']);
export const REGION_FIELDS_V4 = Object.freeze(['id', 'name', 'aliases', 'climate']);
// `content.start` of a world pack, and the start-date fields. A format 3 start key that moved says where it went.
export const WORLD_START_FIELDS = Object.freeze({ keys: ['world', 'date', 'place'], date: ['era', 'year', 'month', 'day', 'hour', 'minute'], moved: { scene: 'use start.place (a place id) instead', inventory: 'the player\'s money and items belong in a game pack, under content.start' } });
// Format 3 cast fields with no format 4 field of that name.
export const RETIRED_CAST_FIELDS = Object.freeze({ about: 'use role, personality and history', skills: 'use abilities', gear: 'use keepsakes', fields: 'Level is a built-in field; other custom fields are the reader\'s' });
