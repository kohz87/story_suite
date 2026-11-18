// The job: the RPG's level cap setting as the `rpg` section of a game pack ("Export settings as a game pack"), and back.
import { LEVEL, LEVEL_CAP_SETTING, levelCapOf } from './names.js';

/** `io` = { read(key), write(key, value) } on Story Block's own settings. → `{ rpg: { read() → { formula, levelCap } or undefined when unset, apply(value) → Promise<boolean> } }`. */
export function rpgSections(io) {
    return {
        rpg: {
            read() { const cap = levelCapOf(io.read(LEVEL_CAP_SETTING)); return cap === null || cap === LEVEL.max ? undefined : { formula: 'v1', levelCap: cap }; },
            async apply(value) { io.write(LEVEL_CAP_SETTING, levelCapOf(value?.levelCap) ?? LEVEL.max); return true; },
        },
    };
}
