// Builds the per-tab selector map for the Story Block port from the gathered answers.

import { selectCard } from './card.js';
import { selectNow } from './now.js';
import { selectReplyMenu } from './chat.js';
import { selectParty } from './party.js';
import { selectBag } from './bag.js';
import { selectLoot } from './loot.js';
import { selectPeople } from './people.js';
import { selectWorld } from './world.js';
import { selectJournal } from './journal.js';
import { selectStory } from './story.js';
import { listProfiles } from '../../core/model-call.js';
import { selectSettings } from './settings.js';
import { selectProblems, selectSent, selectInspector, selectSavePoints } from './tools.js';
import { selectPrompts } from './prompts.js';
import { selectScene, selectFightScene, fightNeeds as needsOf, FIGHT_KIND } from './interaction.js';
import { selectHold } from './hold.js';
import { gather, optsOf, gearOf, partyPortraits } from './gather.js';
import { offerRows } from './offers.js';
import { pinnedFeed } from './pinned.js';
import { PARTY_ACTIVE } from './party-max.js';
import { recordedAt, repairedAt, unrecordedAt } from './unrecorded.js';
import { liveOffer } from '../port/live-offer.js';
import { PREFS_KEY } from '../port/prefs-key.js';
import { pickOf, pickedFocus } from './focus.js';
import { peopleParts, dossierMap } from './people-parts.js';
import { createWizardWorld } from '../wizard/world.js';
import { packPresets } from './people-settings/catalog.js';
import { selectRoster } from './roster.js';
import { liveLorebookRows } from './packs-lorebook.js';
import { arcController } from '../../modules/arc/controller.js';
import { replyCardsOf } from './reply-card.js';
import { selectReplyLog } from './reply-log.js';
import { selectReplyActions } from './reply-actions.js';
import { readTabOrder } from './reply-tabs.js';
import { isCarrier } from '../../core/persist.js';

// The two stored values the Calls group shows that the host settings do not hold: the fallback's kinds (Story Block's bucket) and People's output limit.
// Story Director is on while any of its switches is on (the Settings Director card reads it the same way); a host with no feature list counts as on.
const directorOn = sdk => { const own = sdk?.features?.()?.filter?.(f => f?.moduleId === 'story-director'); return !own?.length || own.some(f => f.on === true); };
const callsOf = ctx => { const modules = ctx()?.extensionSettings?.storySuite?.modules; return { kinds: modules?.['story-block']?.assistExtractorKinds, repair: modules?.['story-block']?.assistRepair, maxOutput: modules?.['npc-state-delta']?.scannerMaxOutputTokens }; };

// The arc planner's waiting plan and state (the page's controller; none without a page).
const arcStatus = () => { try { return arcController().status(); } catch { return null; } };

const openScene = answer => { const view = selectScene(answer); return view && view.kindId !== FIGHT_KIND ? view : null; };

const directorAnswers = (sdk, ctx) => ({ sceneShown: ctx()?.chatMetadata?.[PREFS_KEY]?.scene === true, values: Object.fromEntries(['story-director', 'npc-state-delta'].map(id => [id, sdk?.settings?.(id) ?? null])), features: sdk?.features?.() ?? [] });
// One engine query for the Packs page; a build without it (or a query that throws) gives an empty page.
const ask = (sdk, name) => { try { return sdk?.query?.(name, {}); } catch { return null; } };
// The RPG answers `rpg.sheet` only while it is on: any row is a Character (the pre-roll steps aside for it).
const rpgHasCharacter = sdk => { const rows = ask(sdk, 'rpg.sheet'); return Array.isArray(rows) && rows.length > 0; };

/** Builds the per-tab selector map for the Story Block port: each is `(read) → view-model`, built from sdk queries (UI-PLAN §2). `hold` is the waiting fight's handle (port/hold.js); `cards` the cards under replies (port/reply-cards.js). */
export function buildSelectors(ctx = () => null, sdk = null, tools = null, hold = null, cards = null) {
  // The open fight, or the waiting one (the pause before the reader's message goes out: its offer); an open fight the waiting message goes with is `held` (its Send and Discard answer the pause).
  const fightOf = read => {
    const open = selectFightScene(read('interaction.view', {})), info = hold?.view?.() ?? null;
    if (open) { const place = read('scene.place', {})?.name ?? null, shown = place ? { ...open, place } : open; return info?.choice === 'board' ? { ...shown, held: true } : shown; } // (the header reads "Fight · place")
    return selectHold(info, { sheet: read('rpg.sheet', {}), place: read('scene.place', {})?.name ?? null });
  };
  const wizard = createWizardWorld({ sdk, ctx });
  const problemsNow = () => ({ problems: tools?.problems?.() ?? [], blocked: tools?.blocked?.() ?? null, nameOf: tools?.nameOf });
  const scene = read => {
    const answers = gather(read);
    const opts = { ...optsOf(read, answers, ctx), offers: offerRows(liveOffer()) };
    const fight = fightOf(read); // the open or waiting fight, if one is: the inline chip and the Now card read it
    const picked = pickedFocus(read, pickOf(ctx)); // the Journal's focus pick, while that quest is open
    const base = picked ? { ...opts, focusPick: picked } : opts;
    return { answers, opts: fight ? { ...base, fightOpen: true, fight: needsOf(fight) } : base };
  };
  return {
    card: read => { const s = scene(read); return selectCard(s.answers, s.opts); },
    now: read => { const s = scene(read); return selectNow(s.answers, { ...s.opts, pinned: pinnedFeed(read) }); },
    // The chat surfaces: one card per story reply (`args.replies`: the indexes drawn, default every reply), the newest reply's action line, the tab order,
    // the modules' cards and the ✦ sheet. `args.index` asks for that reply's own sheet (its state, not the head's) and nothing else.
    chat: (read, args) => {
      const at = Number.isInteger(args?.index) && args.index >= 0 ? args.index : null;
      const chat = ctx()?.chat ?? [];
      const s = scene(at === null ? read : (name, a) => read(name, name === 'reply.changes' ? { asOf: at, index: at } : a));
      const replyMenu = selectReplyMenu(s.answers, { ...s.opts, repaired: repairedAt(chat, at), recorded: recordedAt(chat, at) });
      const tabs = readTabOrder(sdk?.settings?.('story-block')?.replyTabs);
      if (at !== null) return { replies: [], head: null, tabs, replyMenu };
      // the loot the newest reply laid out (its own, taken or not), for its action line
      const loot = selectLoot(read('inventory.loot', { reply: true }));
      const index = chat.findLastIndex(isCarrier);
      const head = index >= 0 ? { index, actions: selectReplyActions(s.answers, { fightOpen: s.opts.fightOpen, loot, offers: s.opts.offers, unrecorded: unrecordedAt(chat, null) }) } : null;
      // (the modules' cards are the head reply's, left out when no card answers)
      const replyCards = replyCardsOf(cards?.head?.());
      return { replies: selectReplyLog(read, { chat, indexes: Array.isArray(args?.replies) ? args.replies : null }), head, tabs, replyMenu, ...(replyCards ? { replyCards } : {}) };
    },
    party: read => {
      const actors = read('party.actors', {});
      const vm = selectParty({ actors, pc: read('party.pc', {}), levels: read('party.levels', {}), gear: gearOf(read, actors), sheet: read('rpg.sheet', {}), portraits: partyPortraits(read, ctx, actors) });
      // (the RPG on and no You: the tab offers New character, ui/wizard; the old Party tab's rule)
      return wizard.needsYou() ? { pcId: null, max: PARTY_ACTIVE, canInvite: false, members: [], characters: wizard.characters(), ...vm, newCharacter: true } : vm;
    },
    bag: read => {
      const actors = read('party.actors', {});
      const pc = read('party.pc', {});
      // gear.view is the party's with no main character too: only its carriers (which mount is with the party) are taken then.
      const view = read('gear.view', pc?.id ? { id: pc.id } : {});
      const loot = selectLoot(read('inventory.loot', {}));
      const bag = selectBag({
        rpg: Array.isArray(actors) && actors.length > 0, items: read('inventory.items', {}), counts: read('inventory.counts', {}), gear: pc?.id ? view : null, carriers: view?.carriers,
        wallet: read('inventory.wallet', {}), currency: read('inventory.currency', {}), mounts: read('mounts.list', {}), pace: read('mounts.pace', {}), changes: read('reply.changes', {}), pcId: pc?.id ?? null,
      });
      // every reply's loot not taken yet (the Bag's To pick up)
      return bag && loot.length ? { ...bag, loot } : bag;
    },
    people: read => selectPeople(peopleParts(read)),
    dossier: read => dossierMap(read),
    world: read => {
      const worldEvents = sdk?.features?.()?.find?.(f => f?.id === 'story-director.world-events')?.on === true;
      return selectWorld({ atlasView: read('atlas.view', {}), selected: read('atlas.selected', {}), worldView: read('director.world', {}), tiers: null, worldEvents, conditionsHere: worldEvents ? read('chronicle.conditionsHere', {}) : null, regionNames: read('chronicle.regionNames', {}) });
    },
    journal: read => selectJournal(read, { focusId: pickOf(ctx) }),
    // The plan opens from this chat's own pref (the Story tab's Show the plan writes it); the Threads switch decides whether its beats, clocks, agendas and secrets exist at all.
    story: read => selectStory(read, { arcStatus: arcStatus(), planShown: ctx()?.chatMetadata?.[PREFS_KEY]?.plan === true, threadsOn: sdk?.features?.()?.find?.(f => f?.id === 'story-director.threads')?.on !== false, directorOn: directorOn(sdk) }),
    // The open interaction: `interaction.view`, null when none is open. A fight is shown on the Fight tab, not here.
    scene: read => openScene(read('interaction.view', {})),
    // The open fight: the same answer, drawn by the fight renderer on the activity host (the kind's own view is the FIGHT_SHAPE), or the waiting fight's offer; null when neither.
    fight: fightOf,
    // The tab strip's flags, read on every port event: the RPG is on (the party answers, as the card's `rpg`), a fight is open or waiting, an interaction is open and its title. No scene gather, no `npc.cast`.
    flags: read => {
      const view = read('interaction.view', {});
      const scene = openScene(view);
      const actors = read('party.actors', {});
      return { rpg: (Array.isArray(actors) && actors.length > 0) || wizard.needsYou(), fightOpen: Boolean(fightOf((name, args) => (name === 'interaction.view' ? view : read(name, args)))), sceneOpen: Boolean(scene), sceneTitle: scene?.title ?? '' };
    },
    settings: () => selectSettings({
      host: sdk?.settings?.() ?? {}, defaults: sdk?.settings?.defaults ?? {}, schema: sdk?.settings?.schema ?? {}, features: sdk?.features?.() ?? [], modules: sdk?.modules?.() ?? null, people: sdk?.settings?.('npc-state-delta') ?? {}, director: sdk?.settings?.('story-director') ?? {}, directorCalls: ask(sdk, 'chronicle.directorCalls')?.count ?? 0, directorPage: directorAnswers(sdk, ctx), money: sdk?.settings?.('story-block') ?? {}, extras: sdk?.settings?.('story-block') ?? {}, profiles: listProfiles(), calls: callsOf(ctx), rpg: sdk?.settings?.('story-block') ?? {}, rollsHeld: rpgHasCharacter(sdk), packsAnswers: { list: ask(sdk, 'packs.list'), setup: ask(sdk, 'dataModules.setup'), pairing: ask(sdk, 'packs.pairing'), own: ask(sdk, 'packs.own'), lorebook: liveLorebookRows(ask(sdk, 'packs.list')) },
      subtitle: 'this chat', tools: tools ? { sent: tools.sent(), ...problemsNow() } : null, staticTokens: tools?.staticTokens,
      peoplePresets: packPresets(sdk),
    }),
    // Read again each time the Tools page draws or the Inspector moves (never the overlay's open-time snapshot).
    problems: () => (tools ? selectProblems(problemsNow()) : null),
    sent: () => (tools ? selectSent(tools.sent(), selectProblems(problemsNow())) : null),
    roster: read => selectRoster(read('people.list', {})),
    savepoints: () => (tools ? selectSavePoints(tools.savePoints()) : null),
    prompts: () => selectPrompts(Object.fromEntries(['npc-state-delta', 'story-director'].map(id => [id, sdk?.settings?.(id) ?? null]))),
    inspector: (_read, args) => (tools ? selectInspector({ replies: tools.replies(), reply: i => tools.reply(i) }, args?.index) : null),
  };
}
