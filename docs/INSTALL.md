# Install Story Suite 0.1.2

Story Suite is one SillyTavern extension. It replaces three: Story Block, Story Director and NPC State Delta (called NPC State here). It starts fresh: your old settings, chats' story data and NPC files are not read or migrated.

## Before you start

1. Use SillyTavern 1.19 or newer (the version the suite is built and tested on).
2. **Remove the old three.** In **Extensions → Manage extensions** delete Story Block, Story Director and NPC State Delta; disabling is not enough. Two copies would share one settings key and one generation interceptor, and the new extension does not start while the old Story Block is still enabled (it shows a notice that says to disable the old three).
3. Reload SillyTavern.

## Install

1. Open **Extensions → Install extension**.
2. Paste `https://github.com/kohz87/story_suite` and install it for you (or for all users).
3. Reload SillyTavern. The browser console prints `Story Suite 0.1.2 ready` once, and the Extensions drawer reads `Story Suite 0.1.2`.

This installs the source tree, which SillyTavern loads file by file. The packed build (a handful of files; `npm run release` builds it) is not published yet.

To update later, open **Extensions → Manage extensions** and use the update button; there is nothing else to do.

## First look

- The Story Suite view is what you see (the wand menu's **Story Suite** entry opens it, and so does **Open Story Suite** in the Story Suite drawer under Extensions). The view before it has been removed.
- Model connections: open **Settings → Models** (the gear in the Story Suite view, or **Settings** in the Story Suite drawer under Extensions): the Story connection, the connection for quick helpers and the one for background work ("Same as chat" uses your chat connection).
- Try the example world: open **Settings → Packs and trackers → Import a pack file**, pick `examples/packs/ersveil.zip`, then start a new chat. For the full sample world pack (Ersveil 3.0.0: the map, 31 people with portraits, lore, powers, conditions and world events; the world events part needs the World events switch in Story Director) pick `examples/packs/ersveil-world.zip` instead.

## If something is wrong

- **Nothing appears and a notice names the old extensions:** one of the old three is still on. Delete it (step 2 above) and reload.
- **Diagnostics:** **Settings → Tools** lists problems (Problems) and copies the report (Diagnostics), including a module that failed to start; the rest of the suite still runs.
- Report a problem on `https://github.com/kohz87/story_suite/issues` with the Diagnostics text.

## For developers

Node 24. Run `npm ci` first: the tests and the release build use `acorn`, `acorn-walk`, `esbuild` and `playwright` (dev dependencies). `npm test`, `npm run check` and `npm run release:check` are described in `CLAUDE.md`.
