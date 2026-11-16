// Builds the renderer for every built tab (Party, Bag, Fight, People, World, Journal, Story) from a view-model and a shared context.
import { partyTab } from '../tabs/party/party.js';
import { openSheet } from '../tabs/party/slot-picker.js';
import { bagTab } from '../tabs/bag/bag.js';
import { fightTab } from '../tabs/fight/fight.js';
import { sceneTab } from '../tabs/scene/host.js';
import { peopleTab } from '../tabs/people/people.js';
import { worldTab } from '../tabs/world/world.js';
import { journalTab } from '../tabs/journal/journal.js';
import { openQuestEditor } from '../tabs/journal/quest-editor.js';
import { storyTab } from '../tabs/story/story.js';

const BUILDERS = { party: partyTab, bag: bagTab, fight: fightTab, scene: sceneTab, people: peopleTab, world: worldTab, journal: journalTab, story: storyTab };

/** Returns the tab ids that have a built renderer. */
export const BUILT_TABS = Object.freeze(Object.keys(BUILDERS));

/**
 * Returns `(tab, vm) => node | null`. `ctx` = { port, prefs, go, backStack, doc, width() }; null when the tab has no renderer or no view-model.
 * The Bag gets a sheet opener and the party names; the Party sheets and the Bag sheets share one bottom-sheet frame.
 */
export function createTabViews(ctx) {
  const { port, backStack = null, doc = globalThis.document } = ctx;
  return (tab, vm) => {
    const build = BUILDERS[tab];
    if (!build || !vm) return null;
    const members = Object.fromEntries((port.view('party')?.members ?? []).map(m => [m.id, m.name]));
    let sheet = null;
    const own = {
      ...ctx,
      doc,
      backStack,
      back: backStack,
      members,
      refresh: () => ctx.refresh?.(),
      command: (type, payload) => port.command(type, payload),
      openSheet: (el, label) => { sheet?.close(); sheet = openSheet({ ...ctx, doc, backStack }, { title: label }); sheet.body.appendChild(el); },
      close: () => { sheet?.close(); sheet = null; },
      editQuest: q => openQuestEditor({ ...ctx, doc, backStack }, q, { rpg: vm.rpg !== false }),
      get width() { return ctx.width?.() ?? 0; },
    };
    return build(vm, own);
  };
}
