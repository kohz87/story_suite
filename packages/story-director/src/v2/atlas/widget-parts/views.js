// In-memory map view store per layer and view key.

// Remembered views for this page: `${viewKey}|${layer}` → { cx, cy, zoom (× fit) }. Never story state.
export const views = new Map();
/** Forget remembered views (tests). */
export const forgetViews = () => views.clear();
