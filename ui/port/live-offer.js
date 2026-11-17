// The one card-offer controller the old panel's wiring made, handed to the new view so both show the same offers and answer to the same clicks.

let current = null;

/** The wiring registers its controller here (null when it made none). */
export function setLiveOffer(controller) {
  current = controller ?? null;
}

/** The registered controller, or null: a group chat or a start that failed offers nothing. */
export function liveOffer() {
  return current;
}
