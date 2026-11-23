## Writing a plug-in module

A plug-in module is a SillyTavern extension of its own that links into Story Suite through the SDK. The long guide for people is
`docs/dev/writing-a-module.md`; the references are `examples/fishing` (a mini-game) and `examples/text-rpg` (a rules module: prompt,
Party tab, replaces the RPG). Copy their layout. Do not write a module for what a data module (Settings → Packs and trackers, no code) does.

**Files.**

```
manifest.json   { display_name, loading_order, requires: [], optional: [], dependencies: ["third-party/story_suite"], js: "index.js", author, version }
index.js        const host = globalThis.StoryBlock; host.ready.then(sdk => sdk.registerModule(myModule(sdk)))   (log one line if host.ready is missing)
src/module.js   re-exports the definition; src/module-parts/*.js hold its parts (definition, commands, queries, tail, settings, constants)
src/rules/      pure rules (no ctx, no DOM): easy to test with chosen numbers
tests/          node --test; tests/helpers/host.js wraps createHost from the testkit (copy it from examples/text-rpg/tests/helpers/host.js)
```

The extension lives in its own git repository with `manifest.json` at its root (SillyTavern's Install extension needs that). Import nothing from
Story Suite's files in the extension itself; take everything from `sdk`. The definition is checked at registration by
`core/registry/registry-checks.js#definitionProblems`; `registerModule` throws its sentence.

**Definition keys and shapes.** (`docs/v2/SPEC.md` §3, §4, §6, §13.)

- `id` lowercase `[a-z0-9._-]`; `name`, `version`, `description` text; `icon` `fa-…` (≤ 40 characters); `requires`, `capabilities` as above.
- `domains: { name: { initial(), validate(slice) → string[], counters?: ['wood', 'members/*/xp'], scratch?, deferred?, holders? } }`. Name starts with a
  letter, no `/` or `~`. `initial()` is plain JSON. One owner per domain.
- `commands: { 'mod.verb': (ctx, payload) => ({ summary, data?, narrate? }) }`, or `{ handler, internal?, prelude? }`; names are words joined by dots,
  never starting `capture.` or `module.`. Gate with `Object.assign(handler, { feature: 'mod.on' })`.
- `queries: { 'mod.name': (state, args, tools) => value }`; `null` while the module or its feature is off. Properties: `feature`, `fallback: true`.
- `capture: { kinds: { kind: { grammar: 'one line', aliases?, heads?, display? } }, apply(ctx, line) }`; `line` is `{ op, kind, name, text, labels }`.
- `context: { feature?, static(), tail(view) → { lines, optional }, budget }` (or `parts`). `view` has `state`, `query`, `feature`.
- `hooks: { beforeGenerate(view, info) → { commands: [{ type, payload }] } | null, afterCapture, canGenerate, … }`: they ask for steps, never write.
- `features: [{ id, label, describe, default, prompt?, needs?, presets?, replaces?: ['story-block.rpg'] }]`.
- `settings: { section: 'Page title', defaults, schema: { key: { type: 'bool'|'int'|'choice'|'text'|'list'|'profile', label: 'Section: Name', help?, feature?, max?, options?, form? } } }`.
  `form: 'prompt'` on a `text` field is the prompt editor (`builtin`: the default text, `max`: its length); empty means the built-in. Read with `sdk.settings(id)` or `ctx.settings(id)`.
- `widgets: { 'mod.name': { props, feature?, render(el, props, api) } }` (names start with the module id and a dot) and `screens: [{ id: 'mod/name', title, mounts: ['dialog'], feature?, template: '<ss-widget name="mod.name" data-props="{}"></ss-widget>' }]`.
  The view opens a plug-in's own screen in its bottom sheet (`api = { command, query, preview, commit, on, close }`); `tabs` are not drawn.
- `cards`, `interactions`, `headerControls`, `replayQueries` as in the section above; do not use `tabs`.

**`ctx` in a handler.** `read(domain)` (frozen), `draft(domain)` (own domains only), `call(type, payload)` (same transaction), `query(name, args)`,
`rng()`, `roll('2d6')`, `claim(key)`, `id(prefix)`, `absolute(domain, path)`, `unique`, `ifThere`, `feature(id)`, `settings(id)`, `time()`, `fail(code, message)`,
`cause`, `caller`, `receiptId`, `carrier`. Handlers are synchronous.

**Replay == live: do and do not.**

- Do take every random number from `ctx.rng()` / `ctx.roll()`; draw in a fixed order. Don't call `Math.random`, `Date.now()` or `new Date()`.
- Do list every number that moves in the domain's `counters`. Do call `ctx.absolute(domain, path)` when a command *sets* a number. Don't write
  an absolute number for something that moves by adding.
- Do keep per-item records and per-item counts in keyed maps (`{ [id]: … }`, `practice: { lore: 4 }`). Don't edit a list by position; appending at the end is fine.
- Do derive what follows from other state on each read (level from xp). Don't store a copy of it.
- Do keep per-reply bookkeeping under the reply's id (`ctx.carrier.sid`) or in the receipt's `data`, and list its top-level fields in `scratch`.
- Do claim one-time acts with `ctx.claim(key)`. Don't await, fetch, call a model or touch the DOM in a handler. Plain JSON only in state and `data`.
- A middle delete drops that reply's changes and replays the later ones on the new base; write commands that still make sense there (ids, not positions).
- Do give a command with a switch the same `feature`, answer `FEATURE_OFF` from commands and `null` from queries when it is off.

**Prompt.** `static` and each kind's `grammar` are byte-identical every reply of a chat: no names, counts, times or dice; new static text goes behind a feature.
`tail` carries per-reply facts, the line that must survive first, `optional` lines last. `budget` is tokens (about 4 characters each); ask for the least that works
(Fishing 20, Text RPG 600). Render compact text, never JSON.

**Party tab.** `party.actors` → `[{ id, name, pc? }]` and `party.newCharacter` → a screen id or `null` are plain queries; `rpg.sheet` (rows) and `party.levels`
(`[{ id, name, level, left }]`) are `fallback: true` because the built-in RPG owns them. A sheet row may carry `commands: { spend, skillEdit }` (command names). All answer `null`
while the module is off. Replacing the RPG: a feature with `replaces: ['story-block.rpg']`; active = own feature on **and** the replaced one off (`examples/text-rpg/src/module-parts/active.js#active`).

**Tests.** Use the testkit (`createHost({ modules: [def], settings: { features: { 'mod.on': true } } })`). Required: `definitionProblems(def)` is `[]` (`core/registry.js#definitionProblems`);
each command and each refusal; replay (`host.store.rebuild()`), reload (a second host on a copy of the chat), swipe and back (`host.swipe`, `host.st.swipeTo`),
a middle delete (`host.st.deleteMessage`), a Re-read (`host.turn.reread`); feature off; static bytes equal across two replies with different state.
Run `node --test "tests/*.test.js"` in the extension; in this repository run `npm run check` and the tests of the folders touched.
