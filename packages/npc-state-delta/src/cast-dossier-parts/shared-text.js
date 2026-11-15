// Shared text readers for the cast dossier: object test, clipped text, name comparison key, whole numbers.

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();

/** A name as a comparison key: letters and digits only, lowercase (the same reading as Delta's own name match). */
export function labelKey(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}


export const wholeNumber = value => {
    const number = Number(value);
    return value !== null && value !== '' && Number.isFinite(number) ? Math.round(number) : null;
};
