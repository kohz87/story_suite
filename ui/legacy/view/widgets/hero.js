// ss.hero (view/glass-*.css): the hero card, a character's one-glance sheet. A portrait (the persona avatar for
// the PC, the character card's image, or an NPC's from a query such as Delta's `npc.portrait`; the initial
// when there is none), the name, a level badge on the portrait (a star and the number), the class · title line, bars for HP, MP and SP and one for experience under the
// Terms' own word ("Soul growth"), a time / place / weather corner, and a row of status badges. `compact`
// is the one-row variant for the strip under a reply. The game view can also offer More while a phone fight is open.
// With `you` (the game view's header while `story-block.you` is
// on), a Rank, a Wearing and a Condition row under the place line; without `you` the card draws no such row. With `travel` (Story Director's trip line)
// a Travel row follows them. With `where` (the game view's header) the corner is the scene's one place, and a "Here: names" item (the people present)
// follows the weather. The lines are plain text; with `where` the card has ONE "Edit" button (top-right; beside the name on a phone) that opens one
// editor in the card (view/hero-edit.js: the fields and the commands a Save runs, through the widget api; an `ss.editable` of kind `fields`, with
// the story clock when `clock` is given). Without `where` the card is read-only and the corner has no Here item.
//
// The bars are ss.bar and the badges ss.status (glass.js), so each speaks as it does there. The picture is
// taken only from a safe URL (https, a base64 raster image or a same-origin path, widgets/dom.js); a
// `portraitQuery` is asked through the widget api (a read-only query, a name that looks like one), and what it
// answers is checked the same way. The card is read-only; only its editor runs commands.
//
// Built with createElement and textContent only, like every standard widget (dom.js).
// Public face: re-exports its parts.

export { BAR_MAX, STATUS_MAX, heroBars } from './hero-parts/lists.js';
export { heroLine, heroLevel } from './hero-parts/lines.js';
export { pictureUrl, pictureCandidates, heroPicture } from './hero-parts/picture.js';
export { hero } from './hero-parts/widget.js';
