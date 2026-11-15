// ss.dialog (view/glass-*.css, classes `ss-modal`): the glass dialog. A modal over the page: a titled glass
// panel with some text and up to four buttons. It is labelled by its title (`aria-labelledby`) and described
// by its text; the focus goes in when it opens (the main button, else the first control), Tab and Shift+Tab
// stay inside it, Escape and a click on the dimmed page behind close it, and the focus goes back to where it was
// when it closes or the widget is removed.
//
// The classes are `ss-modal*`, not `ss-dialog*`: those belong to the dialog mount (mounts/dialog.js, wizards),
// which keeps its own look until its screens move to this one. A button runs `onSelect` with `{ dialog: <action
// id> }` and the close paths run it with `{ dialog: 'close' }` (confirm a choice, close: never a story action,
// F95/F96); the dialog closes itself on any of them. The panel is `position: fixed`, so place the widget where no
// ancestor has a backdrop filter or a transform (not inside a `.ss-glass`), or it sits in that ancestor's box.
//
// Built with createElement and textContent only, like every standard widget (dom.js).
// Public face: re-exports its parts.
export { ACTION_MAX, ACTION_KINDS, dialogActions, dialogParagraphs } from './dialog-parts/content.js';
export { dialog } from './dialog-parts/widget.js';
