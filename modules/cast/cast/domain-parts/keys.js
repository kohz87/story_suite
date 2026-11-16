// Name and person key builders for cast entries.

import { lineKey } from '../../../world/changes.js';

/** The identity of a name (`lineKey`): lower case, punctuation squashed. '' for a name with no letters or digits. */
export const keyOf = name => lineKey(String(name ?? ''));

/** The key of a person: `<pack>:<id>`. */
export const personKey = (pack, id) => `${pack}:${id}`;

/** The names a person goes by, as keys: their own and their aliases. */
export const keysOfPerson = person => [keyOf(person?.name), ...(Array.isArray(person?.aliases) ? person.aliases.map(keyOf) : [])].filter(Boolean);
