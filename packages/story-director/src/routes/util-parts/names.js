// Non-empty trimmed string list extraction for route names.

export function names(list) {
    return Array.isArray(list) ? list.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()) : [];
}
