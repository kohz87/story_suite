// Story Director v2: reading the cue lines a hook or tail answers with.

// A hook or tail line: a string, or `{ text, keep: true }` (a pinned cue: Story Block keeps it whatever the tail budget says).
export const cueLinesOf = value => (Array.isArray(value) ? value.filter(line => typeof line === 'string' || (line !== null && typeof line === 'object' && typeof line.text === 'string')) : []);
export const linesOf = value => (Array.isArray(value) ? value.filter(line => typeof line === 'string') : []);
