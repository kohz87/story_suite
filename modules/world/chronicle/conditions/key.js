// The key a condition is kept under, and the JSON pointer of that key. Pure.

/** `<name>@<ref>`: one entry per name and place, route, region or realm. */
export const conditionKey = (name, ref) => `${name}@${ref}`;

/** The key as one path segment (SPEC §2.2 `ctx.ifThere`): "~" and "/" escaped. */
export const pointerOf = key => `/conditions/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
