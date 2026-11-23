// The features a module's own features replace (feature `replaces`): the switch rows for the plug-in's Rules page, the extra subs for its Start card, and the lookup the commands check a write with.

/** The feature records (from the feature list) that a feature of module `moduleId` replaces, each once. */
export function replacedFeatures(features, moduleId) {
  const list = Array.isArray(features) ? features : [];
  const ids = new Set(list.filter(f => f?.moduleId === moduleId && Array.isArray(f.replaces)).flatMap(f => f.replaces));
  return list.filter(f => f && ids.has(f.id) && f.moduleId !== moduleId);
}

/** The row key of the switch for the replaced feature `id` on module `moduleId`'s Rules page: `plugin.<module id>.replaces.<feature id>`. */
export const replacedKey = (moduleId, id) => `plugin.${moduleId}.replaces.${id}`;

/** Switch rows (group "Instead of this plug-in") for the features module `moduleId` replaces: labelled by the feature's label, hinted by its describe. */
export function replacedRows(features, moduleId) {
  return replacedFeatures(features, moduleId).map(f => ({ key: replacedKey(moduleId, f.id), group: 'Instead of this plug-in', type: 'sw', label: String(f.label ?? f.id), hint: f.describe ? String(f.describe) : null, value: f.on === true, default: f.default !== false, options: null, unit: null, tags: [], wide: false }));
}

/** Adds a sub "<label> (built-in)" to the Start card of each module that replaces a feature (`parts` = { defList, set }); the card's own on/off and count of its own switches are not changed. */
export function withReplacedSubs(parts, features) {
  const set = { ...parts.set };
  const defList = parts.defList.map(d => {
    const more = replacedFeatures(features, d.id);
    if (!more.length) return d;
    set[d.id] = { ...set[d.id], subs: { ...set[d.id].subs, ...Object.fromEntries(more.map(f => [f.id, f.on === true])) } };
    return { ...d, subs: [...d.subs, ...more.map(f => ({ key: f.id, label: `${String(f.label ?? f.id)} (built-in)`, hint: String(f.describe ?? ''), on: f.on === true }))] };
  });
  return { defList, set };
}
