## How a module plugs in

A module is a definition object. A built-in module is a folder `modules/<name>/` (the core module, in `core/`, merges the
parts of scene, inventory, data modules and the RPG; Director and NPC State are listed in `core/modules-list.js#BUILTIN_MODULES`);
an outside extension registers its own with `sdk.registerModule(def)` after `await StoryBlock.ready`
(`examples/fishing/index.js` is the reference). The registry (`core/registry.js#createRegistry`) checks the definition when it
registers and refuses it, with a plain sentence, if it breaks a rule (`core/registry/registry-checks.js#definitionProblems`).
The definition names what the module owns; the host does the rest.

- **`id`, `name`, `version`.** The id is lowercase letters, digits, `.`, `_` or `-`.
- **`domains`.** The state the module owns: `{ initial(), validate(slice) }`, validate returning a list of problems. One
  owner per domain, and the initial state is plain JSON.
- **`commands`.** The module's writes, `type(ctx, payload)`, names are words joined by dots (the prefixes `capture.` and
  `module.` are the host's). A handler reads frozen copies (`ctx.read`), changes drafts of its own domains (`ctx.draft`), may
  call other modules' commands in the same transaction (`ctx.call`), takes randomness from `ctx.rng` or `ctx.roll` (never
  `Math.random`: the receipt's seed makes replay identical), claims a one-time key with `ctx.claim`, and returns
  `{ summary, data?, narrate? }`. `ctx.fail(code, message)` or any throw keeps nothing. A command may be `{ handler, internal: true }`
  (not callable from the view) or `prelude: true`.
- **`queries`.** `name(state, args)`: reads that other modules and the view may call; they answer `null` when the module or
  its feature is off. `replayQueries` names the ones a replay guard may ask (they must depend on state and arguments alone).
- **`capture`.** `kinds`: the change-line kinds the module owns, each with one `grammar` line for the prompt; and `apply(ctx, line)`,
  which runs a line as a story command (`line` is `{ op, kind, name, text, labels }`). A kind may be `display`, read for the
  reader alone.
- **`context`.** `static()`, `tail(view)` and `budget` (tokens) for the prompt, or a list of `parts`.
- **`hooks`.** Steps the host calls at fixed points: `beforeGenerate`, `afterCapture`, `canGenerate` and a few named ones
  (`docs/v2/SPEC.md` §6). They ask for `system` steps; they never write state themselves.
- **`settings`, `features`, `cards`.** What the module adds to Settings, the switches the reader can turn off, and the
  cards it shows under replies. (`tabs`, `screens` and `widgets` are still accepted and registered, but the current view draws
  its own fixed tabs from `ui/tabs` and no module or pack screen or tab, so an outside module reaches the view through queries
  and cards only, and a tab such as the one in `examples/fishing` is not drawn today; `docs/dev/ui-and-screens.md` top note.)
- **`interactions`.** Kinds for the interaction port (`core/registry/registry-checks-parts/interaction-problems.js`: `version`,
  `title`, `feature`, `screen`, `limits`, `changes`, `ready`, `open`, `witness`, `validate`, `play`, `settle`, `note`, and optionally
  `actors`, `auto`, `opening`, `view`, `carry` with `next`, `marker`, `autoSend`).
- **`requires`.** `{ storyBlock: '>=2.0.0', peers: { 'story-director': '^2' } }`. A module whose peer is missing, of another
  version or off is dormant: registered, its names kept reserved, nothing else of it runs (`docs/v2/LIFECYCLE.md`).

### What the SDK gives a module

`sdk` is `await StoryBlock.ready` (built by `core/sdk.js#createSdk`; the surface other extensions get is `docs/v2/PUBLIC-API.md`).
Take the host's services from it, never from SillyTavern directly. Its exports and the public API are read from the code:

<!-- generated:sdk -->

Put a model call behind the SDK's model call (`core/model-call.js`) so profiles, queues and the safety net apply.

### A minimal module

A counter of lantern oil: one domain, one command, one query, one change-line kind, a line in the prompt tail. The next
section tests it; both blocks are run by `tests/scripts/ai-readme-examples.test.js`.

```js module-example
export const lantern = {
  id: 'lantern', name: 'Lantern', version: '1.0.0',
  domains: { lantern: { initial: () => ({ oil: 3 }), validate: slice => (Number.isInteger(slice.oil) && slice.oil >= 0 ? [] : ['oil must be a whole number, 0 or more']) } },
  commands: {
    'lantern.burn'(ctx, { amount }) {
      const lamp = ctx.draft('lantern');
      if (amount > lamp.oil) ctx.fail('NO_OIL', 'The lantern has too little oil.');
      lamp.oil -= amount;
      return { summary: `The lantern burns ${amount} oil.`, data: { amount } };
    },
  },
  queries: { 'lantern.oil': state => state.domains.lantern.oil },
  capture: {
    kinds: { lantern: { grammar: '! lantern burn | amount: 1' } },
    apply: (ctx, line) => ctx.call('lantern.burn', { amount: Number(line.labels.amount ?? 1) }),
  },
  context: { static: () => '', tail: view => ({ lines: [`The lantern holds ${view.query('lantern.oil')} oil.`], optional: [] }), budget: 20 },
};
```

Rules of thumb for a new module:

1. Start from a small existing one, such as `modules/time` (read its header comment, then its parts) or `examples/fishing`.
2. Never reach into another module's files; call its commands and queries.
3. Keep each file to one job and at most four exports; a module's index file re-exports its parts.
4. Write the replay tests with the module (below).
5. Add its files to `docs/codemap/jobs.json` and run `npm run codemap`.

A module that owns an activity the reader plays (the fight board is the one built) declares an `interactions` kind and
registers a renderer for it in the view (`docs/dev/interaction.md`, "How the Suite view shows an activity"); it never adds a
button that performs a story action.

Detail: `docs/v2/MODULES.md` (layouts and decisions), `docs/v2/LIFECYCLE.md` (peers and restore), `docs/v2/EVIDENCE.md` and
`docs/v2/REPLAY.md` (guarded blocks), `docs/dev/prompt-and-context.md` (prompt budgets).
