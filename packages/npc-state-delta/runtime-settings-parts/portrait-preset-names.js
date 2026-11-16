// Custom portrait preset names: whether a name is taken and a unique name made from a base.

function portraitCustomPresetNameKey(value) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function portraitCustomPresetNameTaken(presets, name, excludeId = '') {
    const key = portraitCustomPresetNameKey(name);
    if (!key) return false;
    return (presets || []).some(item => String(item?.id || '') !== String(excludeId || '')
        && portraitCustomPresetNameKey(item?.name) === key);
}

export function uniquePortraitCustomPresetName(presets, base, excludeId = '') {
    const root = String(base || 'Custom').trim().slice(0, 72) || 'Custom';
    if (!portraitCustomPresetNameTaken(presets, root, excludeId)) return root;
    for (let suffix = 2; suffix < 1000; suffix += 1) {
        const candidate = `${root} ${suffix}`.slice(0, 80);
        if (!portraitCustomPresetNameTaken(presets, candidate, excludeId)) return candidate;
    }
    return `${root.slice(0, 68)} ${Date.now().toString(36)}`.slice(0, 80);
}
