# Install Story Suite 0.1.0

Story Suite is one SillyTavern extension. It replaces three: Story Block, Story Director and NPC State Delta (called NPC State here). It starts fresh: your old settings, chats' story data and NPC files are not read or migrated.

## Before you start

1. Use SillyTavern 1.19 or newer (the version the suite is built and tested on).
2. **Remove the old three.** In **Extensions → Manage extensions** delete Story Block, Story Director and NPC State Delta; disabling is not enough. Two copies would share one settings key and one generation interceptor, and the new extension does not start while the old Story Block is still enabled (it shows a notice that says to disable the old three).
3. Reload SillyTavern.

## Install

1. Open **Extensions → Install extension**.
2. Paste `https://github.com/kohz87/story_suite` and install it for you (or for all users).
3. Reload SillyTavern. The browser console prints `Story Suite 0.1.0` once.

To update later, open **Extensions → Manage extensions** and use the update button; there is nothing else to do.

## First look

- **Settings → Models** sets the three model connections: Story, Quick helpers, Background. "Same as chat" uses your chat connection.
- Try the example world: **Settings → Tabs & Packs → Import pack file**, pick `examples/packs/ersveil.zip`, then start a new chat.
- Both views ship. The new view is a preview and is off by default in 0.1.0 (the setting `ui.next`); the old view is the one you see until it is switched on.

## If something is wrong

- **Nothing appears and a notice names the old extensions:** one of the old three is still on. Delete it (step 2 above) and reload.
- **Diagnostics:** **Settings → Diagnostics** lists problems, including a module that failed to start; the rest of the suite still runs.
- Report a problem on `https://github.com/kohz87/story_suite/issues` with the Diagnostics text.

## For developers

Node 24, no npm dependencies to install for the tests. `npm test`, `npm run check` and `npm run release:check` are described in `CLAUDE.md`.
