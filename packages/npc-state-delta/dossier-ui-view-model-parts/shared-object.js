/* NPC State Delta dossier view-model part: the plain-object guard every view-model part uses. */

export function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
