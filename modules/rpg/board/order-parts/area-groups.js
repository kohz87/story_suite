// Groups the log's lines so one area roll's bars stay together.

/** Group the contiguous bars of each new area attack without merging separate attacks or old rolls. */
export function areaLineGroups(lines) {
    const out = [];
    let groups = new Map();
    for (const line of lines) {
        if (!line.aoe) { groups = new Map(); out.push([line]); continue; }
        if (!line.aoeFollowup) groups = new Map();
        let group = groups.get(line.aoeGroup);
        if (!group) { group = []; groups.set(line.aoeGroup, group); out.push(group); }
        group.push(line);
    }
    return out;
}
