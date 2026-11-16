// Two small word helpers (a counted noun, a list joined with "and") shared by the offer's summaries and its controller.

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const joinWords = list => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
