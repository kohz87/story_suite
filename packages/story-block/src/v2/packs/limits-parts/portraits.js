// Portrait size limits and the portrait file-name pattern.

// Portraits: image files beside pack.json, named by an entry's `portrait`, imported with the pack (portraits.js). What is stored is at
// most `bytes` each (NPC State Delta keeps a copy per chat); what may be picked is a WebP, PNG or JPEG of up to `source` bytes, which
// the browser makes smaller until it fits (portrait-fit.js: long side at most `side` px, WebP, quality stepped down).
export const PORTRAIT_LIMITS = Object.freeze({ bytes: 150 * 1024, source: 10 * 1024 * 1024, side: 1200, perPack: 32, name: 64 });
export const PORTRAIT_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,58}\.(?:webp|png|jpe?g)$/i;
