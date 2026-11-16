// The label hooks and the disabled state every form control takes.

function named(node, ctx) {
    if (ctx.labelledBy) node.setAttribute('aria-labelledby', ctx.labelledBy);
    else if (ctx.ariaLabel) node.setAttribute('aria-label', ctx.ariaLabel);
}
function setDisabled(node, on) {
    node.disabled = Boolean(on);
    if (on) node.setAttribute('aria-disabled', 'true');
    else node.removeAttribute('aria-disabled');
}

export { named, setDisabled };
