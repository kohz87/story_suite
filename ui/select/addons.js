// Builds the Add-ons page rows: the custom-views switch (not built yet, so shown as a fact, never a setting) and the installed modules, read live from the sdk.

const STATUS = { dormant: 'waiting for a module it needs', 'restore-pending': 'held while a restore finishes' };

const info = (key, group, label, hint, value) => ({ key, group, type: 'info', label, hint, value, default: null, options: null, unit: null, tags: [], wide: false });

const isModule = m => m !== null && typeof m === 'object' && typeof m.id === 'string';

// One module → "RPG 1.2.0" plus why it is not running when it is not; unknown parts are left out.
function moduleValue(m) {
  const name = String(m.name ?? m.id);
  const version = typeof m.version === 'string' && m.version ? ` ${m.version}` : '';
  const why = m.status && m.status !== 'ready' ? ` · ${typeof m.reason === 'string' && m.reason ? m.reason : STATUS[m.status] ?? m.status}` : '';
  return `${name}${version}${why}`;
}

/**
 * `modules`: sdk.modules() ([{ id, name, version, status, reason, … }], in id order) or null when it was not read.
 * → the Add-ons rows. No setting is read or written: the suite has no custom-view host yet (and so no switch to keep), so the row says so.
 */
export function selectAddons(modules) {
  const list = Array.isArray(modules) ? modules.filter(isModule) : [];
  return [
    info('addons.customViews', 'Custom views', 'Allow custom views', 'Sandboxed pages a pack can bring; they can only ask the suite to do things', 'off · not available yet'),
    info('addons.installedModules', 'Modules', 'Installed modules', 'Plug-in code that adds tabs or rules', list.length ? list.map(moduleValue).join(', ') : 'none yet'),
  ];
}
