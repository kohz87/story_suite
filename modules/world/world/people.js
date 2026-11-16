// Story Director v2, part **world**: the people in the scene, widget `story-director.people` (MODULES §F9,
// §F119), on the World screen's Here. Bound to `director.world.here` (props.value).
//
// * With NPC State Delta installed and on, its own present-cast cards (the portraits, now lines, chatter
//   bubbles and meters its Cast tab drew, in its markup and classes), drawn by Delta through the page API it
//   offers (`pageHandles.castApi.render(el, { slot })`); nothing of its markup is copied here. A
//   card opens its dossier (Delta's own click handling). Anyone Story Block lists as here who has no card yet
//   (no dossier, or Delta has not scanned them) is a chip below the cards, so no one is left out.
// * Without it (or while it is off or still loading), one chip per person: with NPC State Delta's queries
//   only, the stance and, when they have a dossier, a link opening it (`openDossier`, a page call it offers).
// * Under each person, their thought from the newest reply's Inner chatter (`thought` / `chatter`, matched
//   by name as the chatter strip links a dossier; known.js hereView). Text goes in as text only.
//
// While NPC State Delta reads a new reply it has no cards yet (`page.busy()`, page API version 2, used only when
// it is a function): the last cards drawn stay, marked "updating", and the people they covered get no chip; a
// person with no earlier card still gets the chip. An older Delta without `busy` behaves as before.
//
// Fresh without a tab switch: Story Block draws the screen again on `head` and `committed` (a new reply, a
// swipe, a delete, a chat change), and NPC State Delta's changes that come later (a scan that ends after the
// reply, a dossier added or edited) reach the widget through the page API's `onChange`: it asks
// `director.world.here` again and redraws, at most once per task. A redraw is one query and the few cards
// and chips here: nothing walks the chat.
// Public face: re-exports its parts.

export { PEOPLE_WIDGET, createPeopleWidget, peopleWidget } from './people-parts/widget.js';
export { HERE_QUERY } from './people-parts/draw.js';
export { dossierOpener, castApi } from './people-parts/delta-api.js';
