// Builds Settings › Packs and trackers from the engine's answers: `packs.list` (the installed packs) and `dataModules.setup` (every data module and whether this chat uses it).

import { addsLine } from '../../packs/panel.js';
import { DM_LIMITS } from '../../modules/data-modules/schema.js';
import { pairLines } from './packs-pair.js';
import { lorebookView } from './packs-lorebook.js';

const list = value => (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []);
const text = value => (typeof value === 'string' ? value.trim() : '');
const nameOf = row => text((row.pinnedDefinition ?? row.definition)?.name) || text(row.module);

function packLine(pack) {
  // A format 3 entry stored before format 4 (refused, never read): the design's line (pack-format-4.md §7), with the checker's words on how to convert it.
  if (pack.problem && /reads format 4 only/.test(pack.problem)) return { id: text(pack.id), name: `${pack.name} ${pack.version}`.trim(), desc: 'Old format: remove it or convert it', on: false, problem: pack.problem };
  const facts = [addsLine(pack), pack.author ? `by ${pack.author}` : ''].filter(Boolean).join(' · ');
  const warn = pack.problem ? `Not usable: ${pack.problem}` : pack.missing?.length ? `Needs ${pack.missing.join(', ')}; its content is offered but those parts will not use it.` : '';
  return { id: text(pack.id), name: `${pack.name} ${pack.version}`.trim(), desc: [facts, warn].filter(Boolean).join(' · '), on: pack.enabled !== false, ...(pack.problem ? { problem: pack.problem } : {}) };
}

const countWord = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const label = pack => `${pack.name} · ${pack.version}`.trim();

// "an 8-month calendar" (the mock's words); "a calendar" for the twelve real months, or when the count is not known.
const calendarWord = (months, real) => (!real && Number.isInteger(months) && months > 0 ? `${/^(8|11|18)/.test(String(months)) ? 'an' : 'a'} ${months}-month calendar` : 'a calendar');
// An add-on pack's line: its data modules by name ("Reputation data module"), as the mock draws it.
const addOnLine = pack => { const names = pack.has?.modules ?? []; return names.length ? `${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]} data module${names.length > 1 ? 's' : ''}` : summary(pack); };

// What a world or game pack holds, in the page's words, joined by " · " (the mock's lines); the counts come from the list rows.
function summary(pack) {
  const c = pack.counts ?? {};
  if (pack.kind === 'world') return [c.places && countWord(c.places, 'place', 'places'), c.routes && countWord(c.routes, 'route', 'routes'), c.worldEvents && countWord(c.worldEvents, 'world event', 'world events'), c.cast && `${c.cast} cast`, c.lore && countWord(c.lore, 'lore entry', 'lore entries')].filter(Boolean).join(' · ') || 'no content';
  const coins = (pack.extras ?? []).find(word => /coins?$/.test(word));
  const parts = [(pack.extras ?? []).includes('a calendar') && calendarWord(pack.has?.months, pack.has?.realMonths === true), coins, (pack.extras ?? []).some(word => /weather table/.test(word)) && 'weather', pack.has?.rank && 'rank', pack.hasStart && 'your start', c.names && 'names', pack.has?.rpg && 'RPG options', c.dataModules && countWord(c.dataModules, 'data module', 'data modules'), c.meterPresets && countWord(c.meterPresets, 'meter preset', 'meter presets')];
  return parts.filter(Boolean).join(' · ') || 'no content';
}

const packRow = pack => ({ id: text(pack.id), name: label(pack), tag: pack.addOn ? 'add-on' : pack.kind, desc: pack.addOn ? `${addOnLine(pack)}; offered in every chat, beside any game` : summary(pack), ...(pack.problem ? { problem: `Not usable: ${pack.problem}` } : {}) });
// The World picker lists the worlds, then None; the Game picker Built-in, then the games (the mock's order).
const picker = (rows, kind, none) => {
  const own = rows.filter(row => row.kind === kind && !row.addOn && !row.problem);
  const choices = own.map(row => ({ value: text(row.id), label: label(row) }));
  return { value: own.find(row => row.enabled)?.id ?? '', options: kind === 'world' ? [...choices, { value: '', label: none }] : [{ value: '', label: none }, ...choices] };
};

/** The format 4 page (the World and Game pickers, the suggestion, the pair's problems, the worlds and games, add-ons), or null when no format 4 pack is installed. */
function selectV4(rows, pairing, lorebook = []) {
  if (!rows.some(row => row.kind)) return null;
  const info = pairing && typeof pairing === 'object' ? pairing : {};
  const wanted = info.recommends ?? null;
  return {
    world: picker(rows, 'world', 'None'),
    game: picker(rows, 'game', 'Built-in'),
    worldName: text(info.world?.name),
    gameName: text(info.game?.name) || 'Built-in',
    suggest: wanted && !wanted.selected ? { id: text(wanted.id), game: text(wanted.name), installed: wanted.installed === true } : null,
    lines: pairLines(info),
    // (a world pack with lore carries its lorebook row: Create, Update or Up to date, and the Use in this chat tick)
    installed: rows.filter(row => row.kind && !row.addOn).map(pack => { const book = list(lorebook).find(item => item.id === text(pack.id)); return { ...packRow(pack), ...(book ? { lorebook: lorebookView(book) } : {}) }; }),
    addOns: rows.filter(row => row.addOn).map(packRow),
  };
}

/**
 * `answers` = { list: packs.list, setup: dataModules.setup, pairing, own, lorebook (the world packs' lorebook rows, packs-lorebook.js) }. → the contract's `packs`: the installed packs (switch = enabled), the data modules
 * a pack brings (switch = used by this chat; a module already in use has no way off, so its switch is locked on) and this chat's trackers.
 */
export function selectPacks(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const rows = list(a.setup);
  const pinned = rows.filter(row => row.pinned === true);
  const packs = list(a.list);
  const v4 = selectV4(packs, a.pairing, a.lorebook);
  const names = Object.fromEntries(packs.map(pack => [text(pack.id), text(pack.name)]));
  return {
    // Format 4: the page lists the worlds and games itself (`v4`); `packs` keeps only the older packs with their on/off switch.
    packs: packs.filter(pack => !v4 || !pack.kind).map(packLine),
    ...(v4 ? { v4 } : {}),
    modules: rows.filter(row => row.packId !== 'chat').map(row => ({
      id: text(row.module), name: nameOf(row), on: row.pinned === true, locked: row.pinned === true || row.available === false,
      // (format 4: the mock's `from <pack>` alone, the switch shows whether it is in use; why it cannot be used is kept)
      desc: v4 ? [text(row.packId) && `from ${names[text(row.packId)] || row.packId}`, row.available === false ? row.reason : ''].filter(Boolean).join(' · ')
        : [text(row.packId) && `from ${row.packId}`, row.pinned ? 'in use in this chat' : row.status, row.reason].filter(Boolean).join(' · '),
    })),
    trackers: {
      cap: DM_LIMITS.pins,
      items: pinned.map(row => {
        const definition = row.pinnedDefinition ?? row.definition;
        const fields = Object.keys(definition?.state ?? {}).length;
        return { id: text(row.module), name: nameOf(row), desc: [`${fields} field${fields === 1 ? '' : 's'}`, definition?.show?.card ? 'shown on Now' : ''].filter(Boolean).join(' · ') };
      }),
    },
  };
}
