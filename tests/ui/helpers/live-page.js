// The live mount for the new view's tests: the old host (the RPG's real screens and pause controller) on a testkit page with a Combat Rules v1 sheet
// (Astra and one group of rats), and, with `next`, the new view mounted on the same page as SillyTavern mounts it (ui/entry/turn-on.js).
import assert from 'node:assert/strict';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { seedCrypto } from '../../suite/qa/helpers/seeded.js';
import { characterV1 } from '../../../modules/rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../modules/rpg/templates-parts/v1-skills.js';
import { foesV1 } from '../../../modules/rpg/templates-parts/v1-foes.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { holdStart } from '../../../core/interaction/start-hold.js';
import { turnOn } from '../../../ui/entry/turn-on.js';

export { settle };

/** `{ doc, host, ui, rpg, replied() }`. `generate(type)` stands for SillyTavern's (default: the fake page's own, with `reply`). */
export async function livePage(t, { next = true, seed = 4401, reply = 'Astra cuts the rat down.' } = {}) {
  const restore = seedCrypto(seed);
  t.after(restore);
  const got = await page(t, { formula: 'standard' });
  const { doc, host } = got;
  // the page's own event dispatch with the event object (the fake DOM's carries only the type), and SillyTavern's elements the view looks for
  doc.dispatchEvent = event => { for (const entry of [...doc.listeners]) if (entry.type === event.type) entry.fn(event); return true; };
  doc.head ??= doc.createElement('head');
  doc.getElementById ??= id => doc.querySelector(`#${id}`);
  for (const id of ['extensions_settings2', 'extensionsMenu', 'chat', 'send_textarea']) { const el = doc.createElement('div'); el.id = id; doc.body.appendChild(el); }
  host.features.set(CORE_FEATURE.fightBoard, true);
  await begin(host);
  for (const definition of [characterV1, skillsV1, foesV1]) assert.equal((await host.sdk.command('dm.define', { definition: structuredClone(definition) })).ok, true);
  await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', str: 30, level: 5 } });
  await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { who: 'Astra', skill1: 'Cut', about1: 'A hard cut', stat1: 'str', type1: 'attack' } });
  await host.sdk.command('dm.set', { module: 'pack.chat/foes', fields: { foe1: 'Rats', count1: 1, level1: 1, tier1: 'minion' } });
  host.ctx.name1 = 'Astra';
  let replying = null;
  host.ctx.generate = type => { replying = host.st.generate(type, { reply }); return replying; };
  await settle();
  if (next) t.after(turnOn({ doc, base: 'http://suite.test/ui/', ctx: () => host.ctx, StoryBlock: { sdk: host.sdk, writes: null, tools: null } }));
  return { ...got, replied: () => replying };
}

/** The reader's attack waits for a fight: the hold the pre-check makes for standing foes, and the head event the turn sends with it. */
export function holdFight(host, text = 'I draw my blade and attack the rats.') {
  host.ctx.chat.push({ is_user: true, name: 'Astra', mes: text, extra: {} });
  assert.ok(holdStart(host.ctx.chatMetadata, host.ctx.chat, { kindId: 'story-block/fight', title: 'Fight', mode: 'known', choices: ['board', 'auto', 'plain'] }));
  host.events.emit('head', { index: host.store.headIndex(), reason: 'interaction-start' });
}
