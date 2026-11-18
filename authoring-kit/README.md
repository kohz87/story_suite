# Authoring kit

Use the kit to draft Story Block data modules from your own world. The kit contains prompts, references and the same pack checker the extension uses.

1. Put your notes in `work/lore/` (that folder is not committed).
2. Follow the prompts in `prompts/data-module/` and the format in `reference/DATA-MODULES-FORMAT.md`.
3. Run `node authoring-kit/check.mjs authoring-kit/work/pack.json` from the repository root. Fix the reported problems until it prints OK.
4. Import the pack in Story Block, then enable the data module for your chat.

If the pack needs another installed module, add `--with-capability <name>` when checking. The pack format and size limits are in `reference/PACK-FORMAT.md` and `reference/LIMITS.md`. Code-module guidance is in `prompts/code-module/`.

To write a pack with forms instead of by hand, use the Pack Studio: Settings › Packs has an **Open Studio** link (a new tab). It opens, checks, edits and exports format 4 world and game packs, and it replaces the old Story Studio (the separate `Story_studio` repository, now archived). From a repository checkout, serve the repository root with a static server (for example `python3 -m http.server 8080`) and open `http://127.0.0.1:8080/studio/`; the page cannot load from a `file:` address. The kit's checker and the Studio use the same pack checker, so a pack that passes one passes the other. Details: `docs/dev/studio.md`.

For a small world with notes, places and routes (a format 4 world pack), see `examples/tiny-world/`.
