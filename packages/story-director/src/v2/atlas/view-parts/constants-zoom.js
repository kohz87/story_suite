// Zoom range constants for the map widget view.

export const ZOOM_OUT = 0.5;          // at most 2× further out than "fit"
export const ZOOM_IN = 8;             // at least 8× closer than "fit"…
export const NEAR_PX = 64;            // …and close enough that the two nearest places are this far apart
export const MAX_ZOOM_SPAN = 5000;    // never more than this × "fit"
