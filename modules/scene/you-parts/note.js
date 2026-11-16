// The one-line ask while {{user}}'s Wearing (Outfit, with gear on) or Condition is still empty. Pure.

/**
 * The one-line ask while Wearing or Condition is still empty (and the feature is on): write the empty parts on this reply, from what the
 * narrator already knows. The Rank is asked only when a pack gives a rank word (`rankLabel`) and it is empty. With gear on, what is worn
 * is the gear's, so the ask is for the Outfit (clothes that are not gear) instead of Wearing. '' once both are set, so
 * the tail is then the same as without the note. It only asks for empty parts: nothing the reader set is ever overwritten.
 */
export function youNote(you, rankLabel = '', gear = false) {
    const empty = part => !(typeof you?.[part] === 'string' && you[part]);
    const wanted = [gear ? 'outfit' : 'wearing', 'condition'].filter(empty);
    if (!wanted.length) return '';
    if (rankLabel && empty('rank')) wanted.unshift('rank');
    return `Your look is not set yet: on this reply write ~ you ${wanted.map(part => `${part}: …`).join(' | ')} for {{user}}, from the persona and what they carry.`;
}
