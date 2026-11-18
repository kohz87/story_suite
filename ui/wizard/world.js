// What the new view's New character wizard reads from the story, built from Story Block's sdk and SillyTavern's context with the same
// modules/rpg helpers the old host's RPG mount uses (modules/rpg/view/index-parts/mount.js): the head state, the persona's name, the head
// reply's block-action key, the numbers in force, the pack's levels, the level cap, and whether the story already has a You.

import { lastCarrier, readRecord } from '../../core/persist.js';
import { PARTY_ACTIVE } from '../../modules/rpg/names.js';
import { LEAN_RPG_FEATURE } from '../../modules/rpg/names-parts/feature.js';
import { levelCapFor, packInForce, packRulesOf, rulesFromSettings } from '../../modules/rpg/rules.js';
import { packLevelsOf } from '../../modules/rpg/levels.js';
import { readParty } from '../../modules/rpg/view/party-data.js';
import { actionsFree, extrasPlan, hasRoom } from '../../modules/rpg/view/wizard-data.js';

const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };
const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();

/** Whether `state` has a character for the reader: one named like the persona; with no persona name, any character at all (the old hold's rule). */
export function hasYouIn(state, persona) {
  const name = clean(persona);
  const party = readParty(state, { own: name });
  return name ? party.some(character => character.own) : party.length > 0;
}

/**
 * `createWizardWorld({ sdk, ctx })` (`ctx()` is SillyTavern's live context) → { headState(), readerName(), replyKey(), rules(), packNote(), levels(),
 * levelCap(), rpgOn(), hasYou(), needsYou(), characters(), world(), query(name, args), chatId() }. `world()` is what Create and its problems read (the old wizard's worldOf).
 */
export function createWizardWorld({ sdk, ctx = () => null }) {
  const query = (name, args) => { try { return sdk?.query?.(name, args) ?? null; } catch { return null; } };
  const view = () => safe(() => sdk?.view?.(), null);
  const headState = () => view()?.state ?? null;
  const readerName = () => clean(safe(() => ctx()?.name1, ''));
  const values = () => safe(() => sdk?.settings?.('story-block'), {}) ?? {};
  const pack = () => {
    const found = safe(() => packRulesOf(query('packs.content', { kind: 'rpg' })), null);
    if (!found) return null;
    const listed = (safe(() => query('packs.list'), []) ?? []).find(entry => entry?.id === found.pack);
    return { ...found, name: String(listed?.name ?? found.pack ?? '') };
  };
  const rules = () => rulesFromSettings(values(), pack());
  const levels = () => { const found = safe(() => packLevelsOf(query('packs.content', { kind: 'rpg' })), null); return { ranks: found?.ranks ?? [], playerRank: found?.playerRank ?? null, levelCap: found?.levelCap ?? null }; };
  const levelCap = () => levelCapFor(values(), levels().levelCap);
  const packNote = () => { const given = pack(); return given && packInForce(values(), given).numbers ? given.name || given.pack || '' : ''; };
  // The head reply's key in the blocks' per-reply count (data-modules/part.js pairKey): the store's head is the chat's last carrier.
  const replyKey = () => {
    const chat = safe(() => ctx()?.chat, []) ?? [];
    const source = readRecord(chat[lastCarrier(chat)])?.source;
    return source?.logical && source?.swipeKey ? `${source.logical}/${source.swipeKey}` : '';
  };
  const rpgOn = () => view()?.feature?.(LEAN_RPG_FEATURE) === true;
  const hasYou = () => safe(() => hasYouIn(headState(), readerName()), false);
  // The Party tab offers New character (and shows for it) while the RPG is on and the story has no You; `characters()` counts the party so far.
  // (one view read: the tab strip asks on every engine event while the roster lists nobody)
  const needsYou = () => { const now = view(); return now?.feature?.(LEAN_RPG_FEATURE) === true && !safe(() => hasYouIn(now.state, readerName()), false); };
  const characters = () => safe(() => readParty(headState(), { own: readerName() }).length, 0);
  const world = () => {
    const state = headState(), persona = readerName();
    const party = readParty(state, { own: persona });
    const free = actionsFree(state, safe(replyKey, ''));
    return { persona, names: party.map(character => character.name), hasYou: party.some(character => character.own), full: party.filter(character => character.left !== true).length >= PARTY_ACTIVE,
      room: hasRoom(state), free, extras: extrasPlan(state, { free }), used: Object.keys(state?.domains?.dataModules?.active ?? {}) };
  };
  const chatId = () => String(safe(() => ctx()?.getCurrentChatId?.() ?? ctx()?.chatId, '') ?? '');
  return { headState, readerName, replyKey, rules, packNote, levels, levelCap, rpgOn, hasYou, needsYou, characters, world, query, chatId };
}
