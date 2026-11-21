## The UI layer

The view is `ui/` (entry `ui/index.js`, started by `ui/entry/turn-on.js`). It reads state only through a port (it holds no
state of its own and calls no module's code to read or write the story; a selector may import a pure helper) and draws what the
port answers. The layers, from the engine out:

1. **The port** (`ui/port/`). `ui/port/contract.js#PORT_METHODS` is the whole surface: `view(name)`, `command(...)`,
   `preview`, `commit` and `on(event, fn)`; `checkPort` validates an implementation. `ui/port/sb-port.js#createSbPort` wraps the
   SDK: views come from injected selectors fed by SDK queries, actions pass through as commands with cause `ui`, and
   nothing throws. `ui/port/fake-port.js#createFakePort` is the same surface over fixtures, for view tests. A story action
   goes through the interaction port, never a plain command (rule 9).
2. **Selectors** (`ui/select/`). A selector turns the recorded answers of queries into a plain **view-model** (for example
   `ui/select/party.js#selectParty`, `ui/select/bag.js`), leaving a gap `null` instead of guessing.
3. **Contracts** (`ui/contract/`). Each view-model has a shape spec (`ui/contract/party.js#PARTY_SHAPE`, the others beside it);
   `ui/contract/shapes.js#checkShape` lists the mismatches by path. A selector's output is checked against its shape in
   tests, so a tab can trust what it draws.
4. **Tabs and sheets** (`ui/tabs/<tab>/`, `ui/sheets/`, `ui/card/`, `ui/settings/`, `ui/shell/`). A tab asks `port.view('party')`
   and draws the view-model with the DOM helper (`ui/kit/dom.js#h`); a tab holds no story logic and reads no state of its own.
5. **Styles** (`ui/css/`, one folder per area). The look follows the design tokens; a layout fix is checked in a real browser
   at phone and desktop width, then inside a replica SillyTavern, before it ships.

To add a screen: write the query in the module, a selector and a shape for its view-model, a fixture in `ui/fixtures/`,
the tab or card that draws it, and tests for the selector (against the shape) and the tab (against the fake port). Reply
cards under a reply, and the settings pages, follow the same path (`ui/port/reply-cards.js`, `ui/select/reply-card.js`,
`ui/chat/reply-cards.js`). Text a reader sees says NPC State, never the old short name. Detail: `docs/dev/ui-and-screens.md`
(its top note says which sections describe the removed view), `docs/v2/GUIDE.md` (the reader's view).
