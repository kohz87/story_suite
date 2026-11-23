// Checks the foes record of a text RPG slice (`slice.foes`, see module-parts/foes-record.js) and reports every damaged field by path.

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** Pushes a problem for each damaged field of a foes record; a slice without one (`undefined`) is fine. */
export function checkFoes(foes, problems) {
    if (foes === undefined) return;
    if (!isObject(foes) || !isObject(foes.groups) || !isObject(foes.fights)) {
        problems.push('foes must hold groups and fights.');
        return;
    }
    if (Object.keys(foes.groups).length > 40 || Object.keys(foes.fights).length > 40) problems.push('foes holds too many groups or fights.');
    for (const [id, group] of Object.entries(foes.groups)) {
        const where = `foes.groups.${id.slice(0, 40)}`;
        if (!isObject(group)) { problems.push(`${where} must be an object.`); continue; }
        if (typeof group.name !== 'string' || !group.name || group.name.length > 60) problems.push(`${where}.name must be a short text.`);
        if (!isInt(group.threat, 0, 5)) problems.push(`${where}.threat must be a whole number from 0 to 5.`);
        if (!isInt(group.count, 0, 200)) problems.push(`${where}.count must be a whole number from 0 to 200.`);
        if (!isInt(group.left, 0, 200)) problems.push(`${where}.left must be a whole number from 0 to 200.`);
        if (typeof group.fight !== 'string' || !group.fight || group.fight.length > 80) problems.push(`${where}.fight must name a fight.`);
    }
    for (const [id, fight] of Object.entries(foes.fights)) {
        const where = `foes.fights.${id.slice(0, 40)}`;
        const rolled = fight?.rolled;
        const sound = isObject(rolled) && Object.values(rolled).every(list => Array.isArray(list) && list.length <= 40 && list.every(key => typeof key === 'string' && key.length <= 80));
        if (!sound || !Array.isArray(fight.taught) || fight.taught.length > 80 || !fight.taught.every(key => typeof key === 'string' && key.length <= 160)) problems.push(`${where} must hold rolled skills and taught lessons.`);
    }
}
