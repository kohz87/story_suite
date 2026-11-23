# Writing a module for Story Suite

A plug-in module is a SillyTavern extension of its own that adds rules, state and prompt lines to Story Suite. This page is for
people. The short, rule-first version for AI coding assistants is the "Writing a plug-in module" part of
[`AI-README.md`](../../AI-README.md); both say the same things.

Two modules are built as demonstrations. Read them beside this page:

- `examples/fishing`: a small mini-game (a domain, three commands, queries, a widget). See its README.
- `examples/text-rpg`: a rules module that shapes the narrator's prompt, fills the Party tab and replaces a built-in feature.

## 1. What a module is

A module is one plain object, its **definition**. The extension's `index.js` waits for Story Suite and hands the object over:

```js
const host = globalThis.StoryBlock;
host.ready.then(sdk => sdk.registerModule(myModule(sdk)));
```

(`examples/fishing/index.js`, `examples/text-rpg/index.js`.) The global is still named `StoryBlock`, for old extensions.
`sdk` is the only door into Story Suite. Never import its files and never reach into SillyTavern.

The definition says what the module owns: state (**domains**), writes (**commands**), reads (**queries**), the story lines the
narrator may write (**capture kinds**), what the model is told (**context**), switches and settings. The host does the rest:
it saves the state on the reply, replays it, shows the settings and keeps the prompt within budget.

### A module or a data module?

| You want | Use |
|---|---|
| New characters, items, places, themes, trackers made of fields | A **data module**: no code, Settings → Packs and trackers (`docs/dev/packs.md`, `docs/v2/DATA_MODULES.md`) |
| Your own numbers, dice or rules that code must keep honest | A module |
| A new change line (`! thing …`) the narrator writes | A module |
| A mini-game or an activity with state | A module |
| Only some extra prompt text | A data module or a pack |

Write a module only when the code has to decide something. If a field and a template do it, use a data module. (A data module whose role is `character`, `skills`, `foes` or `rules` goes quiet while a feature replaces the RPG: no grammar or tail line, its story lines refused quietly, its values kept.)

## 2. The 10-minute walk-through: a camp

We build a module that counts the wood at the camp. It is tiny and it is complete: it passes the registry's checks, it replays
and it can be tested. Make a folder `story-suite-camp/` with `manifest.json`, `index.js` and `camp.js`.

### Step 1: the file that registers it

`index.js`:

```js
import { campModule } from './camp.js';

const host = globalThis.StoryBlock;
if (host?.ready && typeof host.ready.then === 'function') {
    host.ready.then(sdk => sdk.registerModule(campModule(sdk)))
        .catch(error => console.error('[Camp] Could not register with Story Suite:', error));
} else {
    console.warn('[Camp] Story Suite is needed; Camp stays off.');
}
```

`manifest.json` (copy `examples/text-rpg/manifest.json`):

```json
{
  "display_name": "Story Suite Camp",
  "loading_order": 40,
  "requires": [],
  "optional": [],
  "dependencies": ["third-party/story_suite"],
  "js": "index.js",
  "author": "you",
  "version": "1.0.0"
}
```

### Step 2: a domain

A domain is a slice of the chat's state that only your module writes. It is plain JSON. `camp.js`:

```js
const MAX_WOOD = 20;

export function campModule(sdk) {
  return {
    id: 'camp', name: 'Camp', icon: 'fa-fire', version: '1.0.0',
    domains: {
      camp: {
        initial: () => ({ wood: 0 }),
        counters: ['wood'],
        validate: slice => (Number.isInteger(slice.wood) && slice.wood >= 0 && slice.wood <= MAX_WOOD
          ? [] : [`wood must be a whole number from 0 to ${MAX_WOOD}`]),
      },
    },
    // …the next steps add keys here
  };
}
```

`validate` returns a list of problems. After every command the host runs it; a command that leaves a problem is thrown out whole.
`counters` says `wood` is a number that moves (see section 4, it matters for replay).

### Step 3: a command

A command is the only way to change the domain. It runs once, when the story or the reader asks, and the host records the change on the reply.

```js
commands: {
  'camp.gather'(ctx, { amount }) {
    if (!Number.isInteger(amount) || amount < 1) ctx.fail('INVALID', 'Gather a whole number of logs, 1 or more.');
    const bonus = ctx.rng() < 0.25 ? 1 : 0;           // seeded: replay gives the same bonus
    const camp = ctx.draft('camp');                    // a draft of a domain you own
    camp.wood = Math.min(MAX_WOOD, camp.wood + amount + bonus);
    return { summary: `The party gathers ${amount + bonus} logs.`, data: { amount, bonus } };
  },
},
```

The handler is synchronous. It touches only `ctx`. `ctx.fail(code, message)` (or any throw) keeps nothing. The `summary` is what the
narrator is told happened (once, under `[Happened]`).

### Step 4: a query

A query is a read that other modules and the view may call. It gets the state and its arguments:

```js
queries: { 'camp.wood': state => state.domains.camp.wood },
```

Call it with `sdk.query('camp.wood')`.

### Step 5: a change line (capture kind)

The narrator writes change lines at the end of a reply. Your kind says what a line looks like and what it does:

```js
capture: {
  kinds: { wood: { grammar: '! wood gather | amount: 2' } },
  apply: (ctx, line) => ctx.call('camp.gather', { amount: Number(line.labels.amount ?? 1) }),
},
```

`grammar` is one line shown to the narrator (in the static prompt). `apply(ctx, line)` gets `{ op, kind, name, text, labels }` and
runs a command with `ctx.call`. A reply that ends `! wood gather | amount: 2` now adds wood.

### Step 6: a tail line

The tail is the short, changing part of the prompt. Put the facts the model needs this reply there:

```js
context: {
  static: () => '',
  tail: view => ({ lines: [`The camp has ${view.query('camp.wood')} logs.`], optional: [] }),
  budget: 20,
},
```

`budget` is tokens (about 4 characters each). `lines` are always kept first; `optional` lines go first when the room is short.

### Step 7: a feature switch

A feature is a switch in Settings the reader can turn off. Off, your commands answer `FEATURE_OFF`, your queries answer `null` and your
prompt lines vanish.

```js
features: [{ id: 'camp.on', label: 'Camp', default: true, prompt: true, describe: 'Counts the wood at the camp and tells the narrator.' }],
```

Tie the pieces to it: give a handler `Object.assign(handler, { feature: 'camp.on' })`, the same on a query function, and
`context: { feature: 'camp.on', … }`. `prompt: true` tells the reader the feature changes what the model is sent.
Inside your own code, ask `sdk.feature('camp.on')` (or `view.feature(id)`).

### Step 8: a settings page

```js
settings: {
  section: 'Camp',
  defaults: { warn: true },
  schema: { warn: { type: 'bool', label: 'Camp: Warn when the wood is low', feature: 'camp.on' } },
},
```

While the feature is on, Settings has a Rules page named **Camp** with that row. The label's "Camp: " prefix is dropped on the page.
Read the value with `sdk.settings('camp').warn` (in a handler, `ctx.settings('camp')`).

### Step 9: try it

Run the module through the testkit (section 10). The whole working file is about 45 lines. Turn it on in SillyTavern, send a reply that ends
with `! wood gather | amount: 2` and the Camp's tail line appears. Swipe the reply and the wood goes back.

## 3. The definition, key by key

The registry checks the object when you register it (`core/registry/registry-checks-parts/problems.js#definitionProblems`) and refuses
it with a plain sentence: `registerModule` throws, and `index.js` logs it (the `.catch` in step 1). Read the browser console first when nothing happens.

| Key | What it is |
|---|---|
| `id` | Required. Lowercase letters, digits, `.`, `_`, `-`. |
| `name`, `version`, `description` | Text. The name is what the reader sees. |
| `icon` | A Font Awesome class of at most 40 characters, `fa-fish`. Shown on the module's card and Rules page. |
| `requires` | `{ storyBlock: '>=2.0.0', peers: { 'story-director': '^2' } }`. A missing or off peer makes the module dormant (`docs/v2/LIFECYCLE.md`). |
| `capabilities` | Names (`custom-data`) a pack may require. At most 32. |
| `domains` | State you own. See below. |
| `commands` | Your writes. |
| `queries` | Your reads. |
| `replayQueries` | Names of your queries a replay guard may ask (`docs/v2/REPLAY.md`). |
| `capture` | `{ kinds, apply }`: change lines. |
| `context` | The prompt: `static`, `tail`, `budget`, `parts`, `feature`. |
| `hooks` | Steps the host calls at fixed points. |
| `features` | Switches. |
| `settings` | Settings rows and panels. |
| `cards` | Cards under replies. |
| `screens`, `widgets` | Screens and widgets (section 8). |
| `interactions` | Activities the reader plays through the interaction port (`docs/dev/interaction.md`). |
| `headerControls` | One toggle in the game view's title bar. |
| `tabs` | Accepted, but the current view draws its own fixed tabs and none of a module's. Do not build on them. |

### `domains`

```js
domains: { camp: {
  initial: () => ({ wood: 0 }),           // plain JSON, no functions, dates or undefined
  validate: slice => [],                  // a list of problems; empty is fine
  counters: ['wood', 'members/*/xp'],     // numbers that move (`*` is one key)
  scratch: ['perReply'],                  // top-level fields of per-reply bookkeeping
  deferred: true,                         // the slice is made by the first reply that writes it
  holders: { 'bonds/npcs': (key, slice) => ({ /* a whole entry */ }) },
} }
```

The domain name starts with a letter and has no `/` or `~`. One module owns a domain; nobody else writes it. Others ask through your commands.

### `commands`

```js
commands: {
  'camp.gather'(ctx, payload) { /* … */ return { summary, data, narrate }; },
  'camp.tick': { handler(ctx, payload) { /* … */ }, internal: true },   // not callable from the view
  'camp.dice':  { handler(ctx, payload) { /* … */ }, prelude: true },    // a system step before the reply
}
```

Names are words joined by dots. `capture.` and `module.` are the host's. What `ctx` gives you:

| `ctx` | Use |
|---|---|
| `ctx.read(domain)` | A frozen copy of any domain. |
| `ctx.draft(domain)` | A draft of a domain you own. Change it and the host diffs it. |
| `ctx.call(type, payload)` | Another module's command, in the same transaction. A failure fails everything. |
| `ctx.query(name, args)` | A query against the state with your drafts in it. |
| `ctx.rng()`, `ctx.roll('2d6+1')` | Seeded randomness. |
| `ctx.claim(key)` | `false` when that key is already claimed on this line of history. For one-time acts. |
| `ctx.id('pt')` | A new id for a record. |
| `ctx.absolute(domain, path)` | This command *sets* the counter at `path` instead of moving it. |
| `ctx.feature(id)`, `ctx.settings(id)` | The reader's switches and settings. |
| `ctx.fail(code, message)` | Refuse. Codes the examples use: `INVALID`, `NOT_FOUND`, `CLAIMED`, `FEATURE_OFF`, `NOT_ENOUGH`, `REFUSED`. |
| `ctx.cause`, `ctx.caller` | Who asked: `ui`, `capture`, `system`. |

The result is `{ summary, data?, narrate? }`. `narrate: false` keeps the summary out of `[Happened]` (a cast that grants nothing,
a spend of points). The full list is `docs/v2/SPEC.md` §3.2.

### `queries`

A function `(state, args, tools)`. Return `null` when the module or its feature is off. A query may be a function with properties:
`Object.assign(fn, { feature: 'camp.on', fallback: true })` (see section 7 for `fallback`).

The host answers some queries for any module. `persona.name` → the reader's persona name (a string, `''` with none), the name a New character wizard starts with. `persona.portrait` → a safe URL (`/User%20Avatars/<file>`) of the reader's persona picture, or `null` when there is none or its URL is not safe in a CSS `url("...")`; draw it with `--wz-pic` and keep a letter for `null` (`examples/text-rpg/src/wizard/summary.js`). It reads SillyTavern's live context and is stored nowhere, so a replay does not meet it.

### `capture`

`kinds` is `{ name: { grammar, … } }`. The grammar is exactly one line. A kind may also have `aliases` (other words for it), `heads`
(stray lines it takes) and `display` (read for the reader only, no command runs). `apply(ctx, line)` runs on each line.
A line the module refuses is shown in the Problems list; the rest of the reply still applies. The line grammar is `docs/v2/SPEC.md` §4.4.

### `context`

```js
context: {
  feature: 'camp.on',
  static: () => 'Camp: wood is counted by the code.',   // the same bytes every reply
  tail: view => ({ lines: [...], optional: [...] }),
  budget: 40,
}
```

`static` goes in the fixed part of the prompt; `tail` in the changing part. Instead you may give `parts: [{ static?, tail?, feature? }]`.
Rules of the prompt are in section 6.

### `hooks`

A hook is a function the host calls. The ones the examples use: `beforeGenerate(view, info)` returns `{ commands: [{ type, payload }] }`
to run system steps before a reply (Text RPG draws its dice this way, `examples/text-rpg/src/module-parts/hooks.js`).
Others are `afterCapture`, `canGenerate` and a few named ones (`docs/v2/SPEC.md` §6). A hook asks for steps; it never writes state itself.

### `features`

```js
features: [{
  id: 'text-rpg.on', label: 'Text RPG', default: false, prompt: true, replaces: ['story-block.rpg'],
  describe: 'One sentence the reader sees under the switch.',
}]
```

Keys: `id`, `label`, `describe`, `default`, `prompt`, `needs` (`{ kinds, commands, queries, why }`: what another module must register for
this to work), `presets` (`{ lean, full }`: the value for the "How much to track" presets) and `replaces` (section 9).

### `settings`

```js
settings: {
  section: 'Text RPG',                              // the title of your Rules page
  defaults: { tone: 'standard', rules: '' },
  schema: {
    tone: { type: 'choice', label: 'Text RPG: Tone', feature: 'text-rpg.on', options: [{ value: 'gritty', label: 'Gritty' }, …] },
    survival: { type: 'bool', label: 'Text RPG: Survival', feature: 'text-rpg.on' },
    statNames: { type: 'text', label: 'Text RPG: Stat names', max: 80, feature: 'text-rpg.on' },
    rules: { type: 'text', form: 'prompt', label: 'Text RPG: Narrator rules', max: 2000, builtin: DEFAULT_RULES, feature: 'text-rpg.on' },
  },
}
```

(`examples/text-rpg/src/module-parts/settings.js`.) Field types: `bool`, `int` (`min`, `max`), `choice` (`options`, `form: 'segmented'`), `text`
(`max`), `list` (`of`) and `profile`. The Rules page draws `bool`, `int`, `text` and `choice`. A `text` field with `form: 'prompt'` is the
prompt editor: it starts empty (meaning "the built-in text"), shows `builtin` prefilled and has a Reset to default. Other field keys:
`label`, `help`, `group`, `feature` (the row shows only while that feature is on), `readOnly`, `shows`.
Keep a text setting short; the host limits its length. Own panel: `section(el, api)` or `render(el, api)`, and `folds: [{ id, title, hint, render }]`.

### `cards`

`cards: { id: { for(state, message, ctx) } }` draws a card under a reply. A button on a card goes through the interaction port, not a
story action of its own.

## 4. Rules that keep replay == live

State is stored on replies. A swipe, a regenerate, a Re-read, a reload and a **middle delete** (the reader deletes an old reply) all rebuild the
state from the stored changes, and the result must equal what live play gave. Break these rules and a swipe corrupts a chat.

1. **Randomness only from `ctx.rng()` or `ctx.roll()`.** Never `Math.random`. The receipt keeps the seed, so replay draws the same numbers.
   Draw in a fixed order (Fishing decides the fish, then the bite).
2. **No wall clock.** No `Date.now()`, no `new Date()`. If you need time, read the story's clock (`ctx.time()` gives the minutes or null).
3. **Handlers are pure.** Synchronous, no network, no model calls, no DOM, no await. Use only `ctx`.
4. **Counters, not absolute writes, for numbers that move.** Declare `counters: ['wood']`. A change is stored with the number before it; if a middle
   delete changed the number, replay adds *the change* (+2) instead of writing the number the deleted reply left. A number you *set* (a health
   stage "is now 3") calls `ctx.absolute(domain, path)` before returning, so replay sets it again.
5. **Keyed maps, not arrays, for per-item records.** `{ [id]: {…} }`, never a list you edit by position. A change to "item 3 of a list" is
   positional and fails when an earlier item went with a deleted reply. A list that only grows at the end is fine. Per-item counts
   are a map (`practice: { lore: 4 }` with counter `members/*/practice/*`), not a list of pairs.
6. **Derive, do not store, what follows from other state.** Text RPG stores `xp` and `bought`; level, points and active skills are computed on each read
   (`examples/text-rpg/src/module-parts/standing.js`). A stored copy goes wrong when a middle delete takes half of it.
7. **Per-reply bookkeeping lives under the reply's id** (`ctx.carrier.sid`) or in the receipt's `data`, never as a field of a shared object an earlier reply made.
   Name such top-level fields in `scratch`.
8. **A middle delete** removes that reply's changes. The blocks after it replay on the new base; one that no longer applies is skipped and reported, the rest stay.
   So write each command so it still makes sense on a different base: use ids, not positions; validate in `validate`, not in your head.
9. **Claim one-time acts.** `ctx.claim('fishing:<session>:reeled')` makes a second press a `CLAIMED` refusal, also after a replay.
10. **Plain JSON in the domain** and in `data`. No functions, no `undefined`, no class instances.
11. **Old receipt data goes.** `data` older than 200 replies may be dropped. Keep what you need later in your domain.

Detail: `docs/v2/SPEC.md` §2.2 and `docs/v2/REPLAY.md`. Text RPG's README has a worked list of its own choices.

## 5. The reader's clicks and the story

Story actions come from the story: the narrator writes a change line, or the reader says it in a message. There are no buttons for story
actions except through the interaction port (`docs/dev/interaction.md`). Bag management and sheet management (spend points, edit a skill) are
fine. A widget may send a command, as the reader's action (`api.command(type, payload)` runs with cause `ui`). Commands marked `internal`
or `prelude` are refused from the view.

## 6. The prompt and its budget

- **Static part** (`context.static`, each kind's `grammar`): the *same bytes every reply* of a chat. No names, counts, times or dice. It may change
  only with code, settings, packs or a feature. Put a new static line behind a feature (or a setting). The whole static prompt is pinned by a
  golden test of the suite; yours is yours to pin by comparing two replies with different state.
- **Tail** (`context.tail(view)`): the per-reply facts. Code writes them, with code's numbers. `lines` first, then `optional` lines, which go first when room is short.
  Put the line that must survive first (Text RPG puts the dice note ahead of the per-member lines).
- **Budget:** the tail share is about 1,500 tokens for everyone and your `budget` is what you ask for (about 4 characters a token). Fishing asks for 20,
  Text RPG for 600. Ask for the least that works. The static part is never trimmed; too big and the reader gets a "context too small" notice.
- The model never sees JSON. Render compact text. Numbers the reader's character needs in words ("Hurt", "very strong") are better than raw stats.
- Names `{{user}}` and `{{char}}` are filled in for you.

Detail: `docs/dev/prompt-and-context.md`.

## 7. The Party tab

The Party tab draws from queries. A module that keeps characters answers them:

| Query | Answer | Kind |
|---|---|---|
| `party.actors` | `[{ id, name, pc? }]`, the people, with `pc: true` for the reader's own | plain |
| `party.newCharacter` | a screen id to open for "Create your character" while the reader has no character, else `null` | plain |
| `party.pc` | `{ id }` of the reader's own character, else `null` (the Bag's gear and the shared bag follow it) | plain |
| `rpg.sheet` | one row per member: `line`, `level`, `bars`, `effects`, `stats`, `skills`, `points`, … | **fallback** |
| `party.levels` | `[{ id, name, level, left }]` | **fallback** |

A name has one plain owner. The built-in RPG is the plain owner of `rpg.sheet` and `party.levels`, so yours must be `fallback: true` (a second plain
owner is refused). A fallback answers only when the plain owner is held back, its feature is off, or it answers `null`; that is
Text RPG's case (on while the RPG is off). The built-in RPG's `party.actors` is itself a fallback, so a plain `party.actors` of yours is asked first.
`party.newCharacter` is plain too. Gate each on your feature and answer `null` when off (`examples/text-rpg/src/module-parts/queries.js`).

```js
queries: {
  'rpg.sheet': Object.assign(state => rows, { fallback: true, feature: 'my.on' }),
  'party.actors': Object.assign(state => actors, { feature: 'my.on' }),
}
```

A sheet row may carry its own **row commands**: `commands: { spend: 'my.spend', skillEdit: 'my.skillEdit', export: 'my.export' }`. The Party tab then sends your commands
for spending points and editing skills, not the RPG's (`examples/text-rpg/src/module-parts/sheet-row.js`); `export` names a *query* `{ id, inventory?, money? }` → `{ ok, name, fileName, text, own, level, points, items, money }` that the Export sheet asks instead of the RPG's `rpg.characterFile` (a file in the RPG's character file shape, so the New character wizards read each other's). Names are short strings of letters, digits, `.` and `-`.

## 8. Opening a screen in the view's sheet

The view draws one kind of module screen: a plug-in's own screen, in the bottom sheet. Declare a widget and a screen whose template names it:

```js
widgets: {
  'camp.new-hand': { props: {}, feature: 'camp.on', render: (el, props, api) => { /* draw into el; return a cleanup or nothing */ } },
},
screens: [{
  id: 'camp/new-hand', title: 'New hand', mounts: ['dialog'], feature: 'camp.on',
  template: '<ss-widget name="camp.new-hand" data-props="{}"></ss-widget>',
}],
```

Widget names start with your module id and a dot; screen ids are `module/name`. `render(el, props, api)` gets `api = { command, query, preview, commit, on, close }`;
`api.close()` closes the sheet. The Party tab opens such a screen when `party.newCharacter` answers its id (Text RPG: `text-rpg/new-character`,
`examples/text-rpg/src/widget/new-character.js`). Only a plug-in's screen opens this way, only while its module is not dormant and its feature is on
(`core/boot/screen-source.js`, `ui/wizard/plugin-screen.js`). Fishing's widget, `fishing-activity.fishing`, is the other example: a self-contained
widget that takes `props` and an `api` and never reads message text.

Draw with the suite's form styles. Do not draw markup from story text. Do not build on `tabs`.

## 9. Replacing a built-in feature

`replaces: ['story-block.rpg']` on a feature of yours means: turning yours on turns that one off, and turning that one on turns yours off. The reader never has both.
Your module is active only while *your feature is on **and** the replaced one is off*; check both in one helper and use it everywhere
(`examples/text-rpg/src/module-parts/active.js`):

```js
export const active = source => source?.feature?.('text-rpg.on') === true && source?.feature?.('story-block.rpg') !== true;
```

Gate your commands, queries, context and hook on it. Answer `FEATURE_OFF` quietly from a command, `null` from a query.
If the inventory has gear on, you can use its commands (Text RPG wears gear with `ctx.call('gear.wear', …)`, `examples/text-rpg/src/module-parts/kinds/wear.js`); a module that is not there answers `UNKNOWN_COMMAND`, which a handler may catch to treat the command as optional.

## 10. Testing with the testkit

The testkit is a fake SillyTavern and a whole Story Suite host on it (`testkit/index.js`). In this repository a test imports it by relative path
(`examples/text-rpg/tests/helpers/host.js`). Your extension lives in its own repository, so **copy** a small helper from the examples and point it at
a checkout of Story Suite (`import { createHost } from '<path to story_suite>/testkit/index.js'`). Start from one of two helpers:

- `examples/text-rpg/tests/helpers/host.js`: a real host, `createHost({ modules: [def], settings: { features: { 'camp.on': true } } })`, with `host.send(text, reply)`,
  `host.swipe(reply)`, `host.sdk`, `host.store.rebuild()`, `host.head()`, `host.close()`.
- `examples/fishing/tests/helpers/fake-sdk.js`: a small fake sdk with a transaction `ctx` and carriers with swipes; no Story Suite needed. Faster, less true.

A reply is its story and then its block: `` `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` ``.

Write at least these tests (the first four every time):

1. `definitionProblems(def)` is `[]` (`import { definitionProblems } from '<story_suite>/core/registry.js'`).
2. The command does what it says and every refusal changes nothing.
3. **Replay == live:** after two replies, `host.store.rebuild()` gives the same state; a second host built on a copy of the chat (`st: { chat, extensionSettings }`) gives the same state.
4. **Swipe and middle delete:** `host.swipe(...)` replaces the changes; `host.st.swipeTo(i, 0)` brings them back; `host.st.deleteMessage(middle)` keeps the later replies' changes and a rebuild agrees.
5. Feature off: the command answers `FEATURE_OFF`, the query `null`, the prompt has none of your lines.
6. Static prompt: two replies with different state send identical bytes under your key (`host.st.promptLog`, `examples/text-rpg/tests/host.test.js`).
7. A Re-read: `host.turn.reread(index)` after editing `host.ctx.chat[index].mes`.

`examples/text-rpg/tests/replay.test.js` is a full example. Run: `node --test "tests/*.test.js"`.
The worked lantern example in `AI-README.md` ("A minimal module", "Testing a module") is also run as a test, so it is correct.

## 11. Installing

1. Put the module in **its own git repository** with `manifest.json` at the root, so SillyTavern's **Install extension** (the extensions panel, "Install extension" with the repository's URL) can
   fetch it. A folder inside another repository cannot be installed that way. (For testing, copy the folder into
   `public/scripts/extensions/third-party/<name>/` or `data/<user>/extensions/<name>/`.)
2. The manifest needs `"dependencies": ["third-party/story_suite"]` so SillyTavern loads Story Suite first, and `"js": "index.js"`. Copy `examples/text-rpg/manifest.json`.
   (The folder name of Story Suite there is the one SillyTavern installed it under.)
3. Without Story Suite, `index.js` logs one line and the module stays off (see section 2, step 1).
4. In Story Suite: Settings, the Start page, the module's card with its switch (the `name`, `icon` and `features` you gave). Its Rules page (the `settings.section`) shows while its feature is on.

## 12. Checklist

- [ ] `id` is lowercase; the domain, commands and queries are named `module.thing`.
- [ ] `definitionProblems(def)` returns `[]`.
- [ ] Every number that moves is in `counters`; every set calls `ctx.absolute`.
- [ ] No `Math.random`, no `Date`, no await, no network in a handler. Randomness is `ctx.rng()`.
- [ ] Per-item records are keyed maps; per-reply bookkeeping is under the reply id.
- [ ] Nothing derived is stored.
- [ ] Every command, query, context part and hook is gated on your feature; off answers `FEATURE_OFF` or `null`.
- [ ] The static prompt is the same bytes every reply; new static text sits behind a feature.
- [ ] The tail asks for the least `budget` that works; the important line is first.
- [ ] Replay == live tests: rebuild, reload, swipe and back, middle delete, Re-read.
- [ ] One job per file, at most 4 exports, 450 lines at most (the rules of this repository, a good habit in yours).
- [ ] The manifest has `"dependencies": ["third-party/story_suite"]`; the module has its own git repository.
- [ ] A README that says what the reader sees, and what the code decides.
