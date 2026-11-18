// DOM write guards: set a node's text or value only when it changed.

export function setNodeTextIfChanged(node, value) {
    const text = String(value ?? '');
    if (!node || node.textContent === text) return false;
    node.textContent = text;
    return true;
}

export function setNodeValueIfChanged(node, value) {
    const next = String(value ?? '');
    if (!node || node.value === next) return false;
    node.value = next;
    return true;
}
