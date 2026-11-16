// Taking a quantity out of one stack or across several.

export function take(inv, stack, qty) {
    stack.qty -= qty;
    if (stack.qty === 0) delete inv.stacks[stack.id];
}

export function takeAcross(inv, stacks, qty) {
    let left = qty;
    for (const stack of stacks) {
        const n = Math.min(left, stack.qty);
        take(inv, stack, n);
        left -= n;
        if (!left) break;
    }
}
