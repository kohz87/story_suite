// Staging entry for the preview extension: waits for Story Block, adds the "new view (preview)" switch, and mounts the suite on the Story Block port when ui.next is on.

import { mountSuite } from './mount.js';
import { createSbPort } from './port/sb-port.js';
import { addMenuEntry, chatPrefs } from './port/st-chat.js';
import { createChatSurfaces } from './chat/chat-surfaces.js';
import { replyMenuButton, replySheet } from './chat/reply-menu.js';
import { selectCard } from './select/card.js';
import { selectNow } from './select/now.js';
import { selectInlineRow, selectDrawer, selectReplyMenu } from './select/chat.js';
import { selectParty } from './select/party.js';
import { selectBag } from './select/bag.js';
import { selectPeople } from './select/people.js';
import { selectDossier } from './select/dossier.js';
import { selectWorld } from './select/world.js';
import { selectJournal } from './select/journal.js';
import { selectStory } from './select/story.js';
import { selectSettings } from './select/settings.js';

const BODY_CLASS = 'ss-ui-next';
const SWITCH_ID = 'story-suite-ui-next';
const STYLES = ['base', 'shell', 'kit', 'card', 'now', 'chat', 'party', 'bag', 'fight', 'people', 'dossier', 'world', 'journal', 'story', 'settings'];
const EVENTS = ['head', 'committed', 'turn', 'feature'];
const SCENE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.actors', 'party.pc', 'party.levels',
  'party.terms', 'mounts.pace', 'director.goal', 'director.next', 'director.keyPeople', 'atlas.trip', 'inventory.wallet', 'inventory.currency',
  'inventory.encumbrance', 'npc.cast', 'chatter.head', 'time.overdue', 'reply.digest', 'notes.refusedAt'];
const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Asks each query once; `npc.present` carries the meters. A query that is not there is a gap (null), never an error.
function gather(read, names = SCENE) {
  const answers = { 'npc.present': read('npc.present', { meters: true }) };
  for (const name of names) answers[name] = read(name, {});
  return answers;
}

// What the selectors need beyond the answers: the RPG is on when the party answers; portraits come one name at a time.
function optsOf(read, answers, ctx) {
  const names = [...(answers['npc.present'] ?? []).map(row => (typeof row === 'string' ? row : row?.name))];
  const portraits = {};
  for (const name of names) if (name) portraits[name] = read('npc.portrait', { name });
  const lead = answers['party.pc']?.name;
  return {
    rpg: Array.isArray(answers['party.actors']) && answers['party.actors'].length > 0,
    persona: ctx()?.name1 ?? '',
    portrait: lead ? read('npc.portrait', { name: lead }) : null,
    portraits,
    fightOpen: false,
  };
}

function peopleParts(read) {
  const known = read('npc.known', {});
  const dossiers = {};
  for (const row of Array.isArray(known) ? known : []) {
    const name = typeof row === 'string' ? row : row?.name;
    if (name) dossiers[name] = read('npc.dossier', { name });
  }
  const party = read('party.actors', {});
  return { known, dossiers, present: read('npc.present', { meters: true }), cast: read('npc.cast', {}), keyPeople: read('director.keyPeople.view', {}), party };
}

function dossierMap(read) {
  const parts = peopleParts(read);
  const out = {};
  for (const name of Object.keys(parts.dossiers)) {
    const dossier = parts.dossiers[name];
    const vm = selectDossier({
      dossier, meters: read('npc.meters', { name }), next: read('npc.next', { name }), cast: (parts.cast ?? []).find(r => r?.name === name),
      portrait: read('npc.portrait', { name }), keyPeople: parts.keyPeople, party: parts.party,
    });
    if (!vm) continue;
    out[name] = vm;
    out[name.trim().toLocaleLowerCase()] = vm;
    if (isRec(dossier) && dossier.key) out[dossier.key] = vm;
  }
  return out;
}

function gearOf(read, actors) {
  const gear = {};
  for (const actor of Array.isArray(actors) ? actors : []) if (actor?.id) gear[actor.id] = read('gear.view', { id: actor.id });
  return gear;
}

/** Builds the per-tab selector map for the Story Block port: each is `(read) → view-model`, built from sdk queries (UI-PLAN §2). */
export function buildSelectors(ctx = () => null, sdk = null) {
  const scene = read => {
    const answers = gather(read);
    return { answers, opts: optsOf(read, answers, ctx) };
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
        rpg: Array.isArray(actors) && actors.length > 0, items: read('inventory.items', {}), gear: pc?.id ? read('gear.view', { id: pc.id }) : null,
        wallet: read('inventory.wallet', {}), currency: read('inventory.currency', {}), mounts: read('mounts.list', {}), pace: read('mounts.pace', {}), pcId: pc?.id ?? null,
      });
    },
    people: read => selectPeople(peopleParts(read)),
    dossier: read => dossierMap(read),
    world: read => selectWorld({ atlasView: read('atlas.view', {}), selected: read('atlas.selected', {}), worldView: read('director.world', {}), tiers: null }),
    journal: read => selectJournal(read),
    story: read => selectStory(read),
    // The fight board is not a query yet (UI-PLAN §2.3): no view, so the Fight tab stays hidden.
    fight: () => null,
    settings: () => selectSettings({
      host: sdk?.settings?.() ?? {}, defaults: sdk?.settings?.defaults ?? {}, schema: sdk?.settings?.schema ?? {}, features: sdk?.features?.() ?? [],
      subtitle: 'this chat',
    }),
  };
}

function readFlag(ctx) {
  return ctx?.extensionSettings?.storySuite?.ui?.next === true;
}

function writeFlag(ctx, on) {
  const all = ctx.extensionSettings;
  if (!isRec(all.storySuite)) all.storySuite = {};
  if (!isRec(all.storySuite.ui)) all.storySuite.ui = {};
  all.storySuite.ui.next = on;
  ctx.saveSettingsDebounced?.();
}

function addStyles(doc, base) {
  return STYLES.map(name => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}css/${name}.css`;
    link.setAttribute('data-ss-next', '1');
    doc.head.appendChild(link);
    return link;
  });
}

// Draws everything the flag turns on and returns the one function that takes it all away again.
function turnOn({ doc, base, ctx, StoryBlock }) {
  const links = addStyles(doc, base);
  doc.body.classList.add(BODY_CLASS);
  const prefs = { chat: chatPrefs(ctx) };
  const port = createSbPort({ sdk: StoryBlock.sdk, selectors: buildSelectors(ctx, StoryBlock.sdk), prefs });
  const suite = mountSuite({ port, doc, host: doc.body, theme: 'follow' });
  const entry = addMenuEntry(doc, { label: 'Story Suite (preview)', onClick: () => suite.open('now') });
  const drawerHost = doc.createElement('div');
  drawerHost.className = 'ss-drawer-host';
  const form = doc.querySelector('#send_form');
  if (form?.parentNode) form.parentNode.insertBefore(drawerHost, form);
  const surfaces = createChatSurfaces({
    messagesEl: doc.querySelector('#chat'), drawerHost, isNarrow: () => (globalThis.innerWidth ?? 1000) < 600,
    handlers: { onOpenSuite: tab => suite.open(tab), onNeedsYou: () => suite.open('journal'), onFight: () => suite.open('fight'), onOpenPerson: id => { suite.open('people'); port.command('suite.go', { tab: 'people', personId: id }); } },
  });
  let button = null;
  let sheet = null;
  const refresh = () => {
    const vm = port.view('chat');
    surfaces.refresh(vm);
    const bar = [...doc.querySelectorAll('#chat .mes .extraMesButtons')].pop() ?? null;
    if (!bar || !vm?.replyMenu) return;
    if (button && button.parentNode === bar) return;
    button?.remove();
    sheet?.remove();
    sheet = null;
    button = replyMenuButton({
      onOpen: () => {
        if (sheet) { sheet.remove(); sheet = null; return; }
        sheet = replySheet(port.view('chat')?.replyMenu, { onOpenSuite: tab => suite.open(tab), onClose: () => { sheet?.remove(); sheet = null; } });
        bar.parentNode?.appendChild(sheet);
      },
    });
    bar.appendChild(button);
  };
  const offs = EVENTS.map(event => port.on(event, refresh));
  const types = ctx()?.eventTypes ?? ctx()?.event_types ?? {};
  for (const type of [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT]) if (type) ctx()?.eventSource?.on?.(type, refresh);
  const box = doc.querySelector('#send_textarea');
  const typing = () => surfaces.setTyping(String(box?.value ?? '').length > 0);
  box?.addEventListener('input', typing);
  refresh();
  return () => {
    for (const off of offs) off();
    for (const type of [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT]) if (type) ctx()?.eventSource?.removeListener?.(type, refresh);
    box?.removeEventListener?.('input', typing);
    suite.destroy();
    entry?.remove();
    button?.remove();
    sheet?.remove();
    drawerHost.remove();
    doc.querySelector('[data-ss-row]')?.remove();
    for (const link of links) link.remove();
    doc.body.classList.remove(BODY_CLASS);
  };
}

function drawSwitch(doc, on, onToggle) {
  const host = doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings');
  if (!host || doc.getElementById(SWITCH_ID)) return null;
  const box = doc.createElement('input');
  box.type = 'checkbox';
  box.checked = on;
  box.addEventListener('change', () => onToggle(Boolean(box.checked)));
  const text = doc.createElement('span');
  text.textContent = 'Story Suite: new view (preview)';
  const label = doc.createElement('label');
  label.className = 'checkbox_label';
  label.appendChild(box);
  label.appendChild(text);
  const row = doc.createElement('div');
  row.id = SWITCH_ID;
  row.className = 'extension_container';
  row.appendChild(label);
  host.appendChild(row);
  return row;
}

/**
 * Starts the preview: waits for `StoryBlock.ready`, draws the switch, and mounts or removes the new view as ui.next changes.
 * Options: `doc`, `getContext` (SillyTavern's), `StoryBlock`, `base` (this folder's URL). Resolves `{ isOn(), set(on), off() }`, or null without Story Block.
 */
export async function startPreview({ doc = globalThis.document, getContext = () => globalThis.SillyTavern?.getContext?.(), StoryBlock = globalThis.StoryBlock, base = new URL('./', import.meta.url).href } = {}) {
  if (!StoryBlock?.ready || !getContext()) return null;
  await StoryBlock.ready;
  let undo = null;
  const set = on => {
    const ctx = getContext();
    writeFlag(ctx, on);
    if (on && !undo) undo = turnOn({ doc, base, ctx: getContext, StoryBlock });
    if (!on && undo) { undo(); undo = null; }
  };
  drawSwitch(doc, readFlag(getContext()), set);
  if (readFlag(getContext())) undo = turnOn({ doc, base, ctx: getContext, StoryBlock });
  return { isOn: () => undo !== null, set, off: () => set(false) };
}

if (globalThis.SillyTavern && globalThis.StoryBlock) {
  startPreview().catch(error => console.warn('[Story Suite preview] the new view could not start', error));
}
