// Small format helpers: the count name and the Show as value.

// Whole values min..max all named (a choice can list them): else the number is typed and shown by its name where it has one.
export const plural = (n, word) => `${n} ${n === 1 ? word.one : word.other}`;
// Where a block shows now, as the Show as choice names it (a block with no `show` has no tab and no card).
export const showValue = show => (show?.tab && show.card ? 'both' : show?.tab ? 'tab' : show?.card ? 'card' : 'hidden');
