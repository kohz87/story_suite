// A new chat with the RPG on and no character yet (mockup sections 7 and 7b), in two parts that share what the chat remembers (../start.js):
//   * the "Your character" card on Home: the host widget `story-block.rpg-start` (ui-host.js keeps the widget on Home's template and hands
//     it to this file once the RPG screens are loaded). It shows while the RPG is on and the story has no You, with "Create your character"
//     (opens the New character wizard) and "Not now" (hides the card for this chat, stored in the chat's metadata). The Party tab's own
//     "Create your character" stays either way.
//   * the first send: with the RPG on and no You, a normal Send (the Send button, or Enter in the message box; never a swipe, a regenerate, a
//     continue, an impersonation, a quiet or dry run, which do not go through them) is held and the dialog "Make your character first" opens
//     over the chat. The message never leaves the message box while it is held. "Send without the RPG for now" sends it as usual with no dice
//     for that reply and is never asked again in this chat; "Create your character, then send" opens the wizard and sends the message when
//     Create succeeds (the wizard cancelled: the text is back in the box, and the next Send asks again). Closing the dialog puts the text back.
// With the RPG off none of this is mounted (view/index.js is only loaded while the feature is on), so nothing is held.
// Every node is built with createElement and textContent.
// Public face: re-exports its parts.

export { START_WIDGET, HOLD_SCREEN_ID, HOLD_WIDGET, createHoldScreen } from './start-parts/hold-screen.js';
export { createStart } from './start-parts/create-start.js';
