// Names the board's foe groups: a member's base name, its plural, and an area attack's group name.

export const memberBaseName = (member, realFoe) => String(realFoe?.name ?? String(member?.name ?? '')
    .replace(/ pack \d+$/u, '').replace(/ \d+$/u, ''));
export const pluralName = name => (!name ? '' : /s$/iu.test(name) ? name : `${name}s`);

/** Name one group for an area attack, retaining a lone foe's name and naming multiple packs together. */
export const areaGroupName = foe => {
    const name = String(foe?.name ?? ''), count = Number(foe?.count);
    if (count > 12) return /\bpacks$/iu.test(name) ? name : `${name} packs`;
    return count > 1 && count <= 5 ? pluralName(name) : name;
};
