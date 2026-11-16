# Changelog

## 0.1.0

First release of Story Suite as one extension. It brings together what was Story Block, Story Director and NPC State Delta (now called NPC State). Their own changelogs, with every earlier version, are kept in `docs/history/packages/`.

- **One repository, one number.** Every place that carries the version (`package.json`, `package-lock.json`, `manifest.json` once it exists, `core/version.js`, the title of `README.md`, the head of this file) must say the same thing; `npm run release:check` fails if one disagrees, and `node scripts/release.mjs <version>` writes the number into all of them. A release is a version bump merged to main; releases are not tagged.
- **Fresh start.** Nothing from the three old extensions is carried over: no settings, chats or sidecar files are migrated. See `docs/INSTALL.md` for the install steps and for removing the old three.
- **Code layout.** `core/` (host), `modules/` (scene, inventory, data modules, assist, RPG, time, atlas, world, cast, arc, people), `ui/` (the new view and `ui/legacy`, the old view), `packs/`, `testkit/`. See `docs/codemap.md`.
