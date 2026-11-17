// Builds the per-tab selector map for the Story Block port from the gathered answers.

import { selectCard } from './card.js';
import { selectNow } from './now.js';
import { selectInlineRow, selectDrawer, selectReplyMenu } from './chat.js';
import { selectParty } from './party.js';
import { selectBag } from './bag.js';
import { selectPeople } from './people.js';
import { selectWorld } from './world.js';
import { selectJournal } from './journal.js';
import { selectStory } from './story.js';
import { listProfiles } from '../../core/model-call.js';
import { selectSettings } from './settings.js';
import { selectScene, selectFightScene, fightNeeds as needsOf, FIGHT_KIND } from './interaction.js';
import { gather, optsOf, gearOf } from './gather.js';
import { peopleParts, dossierMap } from './people-parts.js';

// The two stored values the Calls group shows that the host settings do not hold: the fallback's kinds (Story Block's bucket) and People's output limit.
const callsOf = ctx => { const modules = ctx()?.extensionSettings?.storySuite?.modules; return { kinds: modules?.['story-block']?.assistExtractorKinds, maxOutput: modules?.['npc-state-delta']?.scannerMaxOutputTokens }; };

/** Builds the per-tab selector map for the Story Block port: each is `(read) → view-model`, built from sdk queries (UI-PLAN §2). */
export function buildSelectors(ctx = () => null, sdk = null) {
  const scene = read => {
    const answers = gather(read);
    const opts = optsOf(read, answers, ctx);
    const fight = selectFightScene(read('interaction.view', {})); // the open fight, if one is: the inline chip and the Now card read it
    return { answers, opts: fight ? { ...opts, fightOpen: true, fight: needsOf(fight) } : opts };
  };
  return {
    card: read => { const s = scene(read); return selectCard(s.answers, s.opts); },
    now: read => { const s = scene(read); return selectNow(s.answers, s.opts); },
    chat: read => {
      const s = scene(read);
      return { inlineRow: selectInlineRow(s.answers, s.opts), drawer: selectDrawer(s.answers, s.opts), replyMenu: selectReplyMenu(s.answers, s.opts) };
    },
    party: read => {
      const actors = read('party.actors', {});
      return selectParty({ actors, pc: read('party.pc', {}), levels: read('party.levels', {}), gear: gearOf(read, actors) });
    },
    bag: read => {
      const actors = read('party.actors', {});
      const pc = read('party.pc', {});
      return selectBag({
        rpg: Array.isArray(actors) && actors.length > 0, items: read('inventory.items', {}), counts: read('inventory.counts', {}), gear: pc?.id ? read('gear.view', { id: pc.id }) : null,
        wallet: read('inventory.wallet', {}), currency: read('inventory.currency', {}), mounts: read('mounts.list', {}), pace: read('mounts.pace', {}), pcId: pc?.id ?? null,
      });
    },
    people: read => selectPeople(peopleParts(read)),
    dossier: read => dossierMap(read),
    world: read => selectWorld({ atlasView: read('atlas.view', {}), selected: read('atlas.selected', {}), worldView: read('director.world', {}), tiers: null }),
    journal: read => selectJournal(read),
    story: read => selectStory(read),
    // The open interaction: `interaction.view`, null when none is open. A fight is shown on the Fight tab, not here.
    scene: read => { const view = selectScene(read('interaction.view', {})); return view && view.kindId !== FIGHT_KIND ? view : null; },
    // The open fight: the same answer, drawn by the fight renderer on the activity host (the kind's own view is the FIGHT_SHAPE); null when no fight is open.
    fight: read => selectFightScene(read('interaction.view', {})),
    settings: () => selectSettings({
      host: sdk?.settings?.() ?? {}, defaults: sdk?.settings?.defaults ?? {}, schema: sdk?.settings?.schema ?? {}, features: sdk?.features?.() ?? [], profiles: listProfiles(), calls: callsOf(ctx),
      subtitle: 'this chat',
    }),
  };
}
