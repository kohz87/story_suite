// Builds Settings › Packs and trackers from the engine's answers: `packs.list` (the installed packs) and `dataModules.setup` (every data module and whether this chat uses it).

import { addsLine } from '../../packs/panel.js';
import { DM_LIMITS } from '../../modules/data-modules/schema.js';

const list = value => (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []);
const text = value => (typeof value === 'string' ? value.trim() : '');
const nameOf = row => text((row.pinnedDefinition ?? row.definition)?.name) || text(row.module);

function packLine(pack) {
  const facts = [addsLine(pack), pack.author ? `by ${pack.author}` : ''].filter(Boolean).join(' · ');
  const warn = pack.problem ? `Not usable: ${pack.problem}` : pack.missing?.length ? `Needs ${pack.missing.join(', ')}; its content is offered but those parts will not use it.` : '';
  return { id: text(pack.id), name: `${pack.name} ${pack.version}`.trim(), desc: [facts, warn].filter(Boolean).join(' · '), on: pack.enabled !== false, ...(pack.problem ? { problem: pack.problem } : {}) };
}

/**
 * `answers` = { list: packs.list, setup: dataModules.setup }. → the contract's `packs`: the installed packs (switch = enabled), the data modules
 * a pack brings (switch = used by this chat; a module already in use has no way off, so its switch is locked on) and this chat's trackers.
 */
export function selectPacks(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const rows = list(a.setup);
  const pinned = rows.filter(row => row.pinned === true);
  return {
    packs: list(a.list).map(packLine),
    modules: rows.filter(row => row.packId !== 'chat').map(row => ({
      id: text(row.module), name: nameOf(row), on: row.pinned === true, locked: row.pinned === true || row.available === false,
      desc: [text(row.packId) && `from ${row.packId}`, row.pinned ? 'in use in this chat' : row.status, row.reason].filter(Boolean).join(' · '),
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
