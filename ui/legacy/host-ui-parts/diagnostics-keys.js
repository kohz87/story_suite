// The fold keys a module placed in Settings → Diagnostics, read from the registry's settings definitions.

/** The fold keys a module placed in Settings → Diagnostics (`place: 'diagnostics'`): "story-block/events". */
export function diagnosticsKeys(registry) {
    const defs = typeof registry?.settingsDefs === 'function' ? registry.settingsDefs() : [];
    return defs.flatMap(def => [
        ...(def.place === 'diagnostics' ? [def.moduleId] : []),
        ...(Array.isArray(def.folds) ? def.folds : []).filter(item => item.place === 'diagnostics').map(item => `${def.moduleId}/${item.id}`),
    ]);
}
