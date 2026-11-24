// The one list of what a settlement kind is (a village, a town, a city), shared by the scene's place filing and the cast's readers of where the party is.

const SETTLEMENT = new Set(['village', 'hamlet', 'town', 'city', 'capital', 'settlement', 'port', 'fort', 'fortress', 'hold']);

/** Whether a kind says a village, town or city ("settlement", "river village"); a district, a ward or a quarter is not one. */
export const isSettlementKind = kind => String(kind ?? '').toLowerCase().split(/[\s/,;|-]+/).some(word => SETTLEMENT.has(word));
