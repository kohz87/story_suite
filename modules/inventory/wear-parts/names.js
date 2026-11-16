// Joins names into a list ("A, B and C").

// ---------- equipment through the rules module ----------
//
export function joinNames(names) {
    return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
