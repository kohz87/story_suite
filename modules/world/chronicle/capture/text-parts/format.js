// Story Director v2, chronicle part: formats chronicle capture lines, labels, and receipt sentences.

/** The line as the story wrote it, for messages. */
export function lineText(line) {
    const labels = Object.entries(line?.labels ?? {}).map(([label, value]) => ` | ${label}: ${value}`).join('');
    return `${line?.op ?? ''} ${line?.kind ?? ''} ${line?.name ?? ''}${line?.text ? ` — ${line.text}` : ''}${labels}`.trim();
}

// The first label of `labels` given under one of `names`, or undefined.
export function labelOf(labels, names) {
    for (const name of names) if (labels[name] !== undefined) return labels[name];
    return undefined;
}

// A summary text as the receipt tells it: the sentence's own full stop is not doubled.
export const sentence = text => text.replace(/([.!?…])\.$/, '$1');
