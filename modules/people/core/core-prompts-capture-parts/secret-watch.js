/* The STORY EVENTS watch: its words as sent, and the reader's view of them with no note's wording. */

// The watch's event for a pack secret that may come out: it quotes the secret's start.
const secretWatchEvent = text => `the secret "${String(text ?? '').slice(0, 60)}" comes out`;

const HEAD = 'STORY EVENTS to look for (present NPCs\' hidden notes): ';
// The event must happen as written, by the actor it names; each returned key carries a quote the code checks (secretEventsShown).
const EVENT_STRICT_RULE = 'An event counts only when it happens as written, by the actor it names ("pressed" needs someone to press that person on it); the person raising the topic themselves, a mention, a hint or something about to happen does not. Also return "secretEventEvidence":{"<key>":"short exact quote showing the event"} for every key; no quote, no key.';
// The one-pass lines builder keeps the event rule's first sentence as it is; the two JSON sentences ("Return top-level secretEvents", "Also return
// secretEventEvidence") are replaced by the approved line form.
const LINE_FORM = 'Because there is no JSON block in the reply, a secret event is written as a line: ~ reveal Name | opened: <key> | quote: "short exact quote from this reply". Only when the event happened as written, by the actor it names. No quote, no line.';
const EVENT_FIRST_SENTENCE = EVENT_STRICT_RULE.slice(0, EVENT_STRICT_RULE.indexOf(' Also return'));
const asked = (shown, only) => `. Return top-level "secretEvents":["<key>",...] with ONLY the keys whose event ${shown}${only}; [] or omit when none. ${EVENT_STRICT_RULE}`;
// The fixed words after the list, by form: the scan's (the current exchange, or a window of replies) and the lines builder's. Each is longer than
// any note's wording in the list can be (an event <= 120 characters, a quoted secret's first 60).
const ENDINGS = {
    current: asked('the CURRENT exchange clearly shows happened (never from earlier history, never a guess)', ''),
    window: asked('the supplied story shows happened', ' (clearly, never a guess)'),
    lines: `. ${EVENT_FIRST_SENTENCE} ${LINE_FORM}`,
};

// The lists sent, each with its reader's form (the latest KEPT): the reader's view looks a list up whole and never reads inside it.
const KEPT = 100;
const readers = new Map();
const UNKNOWN = '(hidden notes)';

/** The watch of `items` ([{ key, name, event }]) as sent, ending as `form` ('current', 'window' or 'lines') does. */
function storyWatch(form, items) {
    const list = items.map(item => `${item.key} = ${item.name}: ${item.event}`).join(' | ');
    readers.delete(list);
    readers.set(list, items.map(item => `${item.key} = ${item.name}: 1 hidden note`).join(' | '));
    if (readers.size > KEPT) readers.delete(readers.keys().next().value);
    return `${HEAD}${list}${ENDINGS[form]}`;
}

/**
 * The sent text as the reader may see it: each item of a watch reads "key = Name: 1 hidden note", as the tail's hidden-note lines do. The list is
 * what stands between the watch's fixed first words and one of its fixed endings. A list that was not sent from here reads "(hidden notes)"; with no
 * ending to be found, nothing after the first words is shown.
 */
function hideSecretWatch(text) {
    let rest = String(text ?? '');
    let out = '';
    for (let at = rest.indexOf(HEAD); at >= 0; at = rest.indexOf(HEAD)) {
        out += rest.slice(0, at + HEAD.length);
        rest = rest.slice(at + HEAD.length);
        const ends = Object.values(ENDINGS).map(ending => ({ ending, at: rest.indexOf(ending) })).filter(found => found.at >= 0).sort((a, b) => a.at - b.at);
        if (!ends.length) return `${out}${UNKNOWN}`;
        const [{ ending, at: end }] = ends;
        out += `${readers.get(rest.slice(0, end)) ?? UNKNOWN}${ending}`;
        rest = rest.slice(end + ending.length);
    }
    return out + rest;
}

export { secretWatchEvent, storyWatch, hideSecretWatch };
