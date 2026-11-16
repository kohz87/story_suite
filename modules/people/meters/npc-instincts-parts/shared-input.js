// Small input readers shared by the signal readers and the step: ids, story days, plain cause text and place names.

const CAUSE_MAX = 120;

export const idOf = value => (value === null || value === undefined || value === '' ? '' : String(value).trim());
export const dayOf = value => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Math.floor(Number(value)) : null);

export const plainCause = (text, fallback) => {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, CAUSE_MAX);
    return clean || fallback;
};

// A place's own name: the part before a region ("Market District, Highmark Capital" and "Bluewatch / Guild Office" both lose the rest), lower case.
const placeKey = name => idOf(name).toLowerCase().split(/\s*[,/]\s*/)[0].trim();

// The same place under a fuller or shorter name ("Ram's Head" and "Ram's Head Inn"): one name's words open the other's. Run 3 read these as arrivals.
export function samePlace(a, b) {
    const x = placeKey(a).split(/\s+/).filter(Boolean);
    const y = placeKey(b).split(/\s+/).filter(Boolean);
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    return short.length > 0 && short.every((word, i) => word === long[i]);
}
