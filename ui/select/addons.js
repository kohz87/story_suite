// Builds the Add-ons page rows: the installed modules, read live from the sdk.

const STATUS = { dormant: 'waiting for a module it needs', 'restore-pending': 'held while a restore finishes' };

const info = (key, group, label, hint, value) => ({ key, group, type: 'info', label, hint, value, default: null, options: null, unit: null, tags: [], wide: false });

const isModule = m => m !== null && typeof m === 'object' && typeof m.id === 'string' && m.hidden !== true;

// One module → "RPG 1.2.0" plus why it is not running when it is not; unknown parts are left out.
function moduleValue(m) {
  const name = String(m.name ?? m.id);
  const version = typeof m.version === 'string' && m.version ? ` ${m.version}` : '';
  const why = m.status && m.status !== 'ready' ? ` · ${typeof m.reason === 'string' && m.reason ? m.reason : STATUS[m.status] ?? m.status}` : '';
  return `${name}${version}${why}`;
}

/**
 * `modules`: sdk.modules() ([{ id, name, version, status, reason, … }], in id order) or null when it was not read; a module with `hidden: true` is not listed.
 * → the Add-ons rows (the installed modules). No setting is read or written. There is no custom-views row: the feature does not exist yet.
 */
export function selectAddons(modules) {
  const list = Array.isArray(modules) ? modules.filter(isModule) : [];
  return [
    info('addons.installedModules', 'Modules', 'Installed modules', 'Plug-in code that adds tabs or rules', list.length ? list.map(moduleValue).join(', ') : 'none yet'),
  ];
}
