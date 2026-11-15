// The skills a Skills block holds, as plain records.

import { STATS } from '../../index.js';
import { skillFieldSlots, isTypedSkills, signatureAt, skillTypeOf } from '../../../skill-slots.js';
import { textOf, whole } from './shared-basics.js';
import { rankName } from './words.js';

/**
 * The skills a Skills block holds: `[{ slot, name, about, stat, uses, rank, rankName, practice, signature? }]`, empty slots left out (`signature`: the pack gave it, the `sig` mark). `stat` is
 * one of the seven stat keys and `uses` 'stamina' | 'mana' (null for a block made before they were fields).
 */
export function skillsOf(block) {
    const out = [];
    for (let slot = 1; slot <= skillFieldSlots(block.fields); slot += 1) {
        const name = textOf(block.fields[`skill${slot}`]);
        if (!name) continue;
        const rank = whole(block.fields[`rank${slot}`]);
        const stat = textOf(block.fields[`stat${slot}`]).toLowerCase(), uses = textOf(block.fields[`uses${slot}`]).toLowerCase();
        out.push({ slot, name, about: textOf(block.fields[`about${slot}`]), stat: STATS.includes(stat) ? stat : null, uses: uses === 'mana' || uses === 'stamina' ? uses : null,
            rank, rankName: rankName(block.definition.state?.[`rank${slot}`], rank), practice: whole(block.fields[`practice${slot}`]),
            ...(signatureAt(block.fields.sig, slot) ? { signature: true } : {}), ...(isTypedSkills(block.fields) ? { type: skillTypeOf(block.fields, slot) } : {}) });
    }
    return out;
}
