// `? try Who | skill or stat | difficulty [| against: Name] [| edge: +1 (reason)] [| hit: what struck them]`: a failure or a success at a cost wounds only with `hit:` (the story shows the roller struck; the band sets how many stages); the code reads the verdict from the reply's recorded die, the bonus and the difficulty (with foes standing the group's threat starts it, else the narrator's word; the edge moves it, conditions hold a floor, the tone shifts it). An old line's `threat:` is ignored.
import { DIFFICULTIES, difficultyIndex, isDifficultyWord } from '../../rules/difficulty.js';
import { readEdge } from '../../rules/edge.js';
import { floorIndex, raiseToFloor } from '../../rules/floor.js';
import { harmFor } from '../../rules/harm.js';
import { rollPractice } from '../../rules/practice.js';
import { verdict } from '../../rules/roll.js';
import { stageOf } from '../../words/pools.js';
import { recordOf } from '../dice-source.js';
import { foeFor } from '../foe-pick.js';
import { standing } from '../foes-record.js';
import { noteRolled } from '../foes-fights.js';
import { BAND_WORD } from '../band-words.js';
import { bonusFor } from '../bonus.js';
import { addPractice, threatHeard } from '../practice-gain.js';
import { costPaidAlready } from '../paid-marks.js';
import { floorWhy } from '../floor-why.js';
import { liveConditions } from '../conditions.js';
import { skillActive } from '../effective.js';
import { gearOf } from '../gear.js';
import { poolWith } from '../gear-sizes.js';
import { partsOf, labelOf } from '../line-read.js';
import { toneStep } from '../settings.js';
import { woundsAfter, woundsOf } from '../standing.js';
import { spendCost } from './pools.js';
import { target } from './target.js';

const PHYSICAL = ['str', 'vit', 'agi', 'dex'];
const LAST = DIFFICULTIES.length - 1;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

export function applyTry(ctx, line) {
    const { slice, member } = target(ctx, line, { acts: true });
    const [what, ...rest] = partsOf(line);
    // The difficulty word is the first part that is one, so a narrator's extra part (`| slip past | hard`) does not hide it.
    const word = rest.find(isDifficultyWord) ?? rest[0];
    if (!what) ctx.fail('INVALID', 'A roll needs a skill or a stat.');
    const record = recordOf(ctx, slice);
    if (!record) ctx.fail('REFUSED', 'There are no dice for this reply.');
    if ((record.used ?? 0) >= record.list.length) ctx.fail('LIMITED', 'This reply has used all its dice.');
    const { cap } = gearOf(ctx.query, member);
    const found = bonusFor(member, what);
    if (found.skill && !skillActive(member, found.skill)) ctx.fail('REFUSED', `${found.skill.name} is not known at this level.`);
    // A `~ spend` of the same skill earlier in this reply already paid it (and a later one will see this try paid).
    const costPaid = found.skill ? costPaidAlready(slice, ctx.reply?.sid, found.skill, 'try') : false;
    const refused = found.skill && !costPaid ? spendCost(member, found.skill, cap) : '';
    if (refused) ctx.fail('NOT_ENOUGH', refused);

    // While foes stand the strongest group (or the one `against:` names) sets the threat, whatever word the narrator wrote (a `threat:` on the line is ignored).
    const { group, missed } = foeFor(slice, labelOf(line, 'against'), record.clock);
    const ruled = group ? group.threat : null;
    // Only a group `against:` itself named is touched, for `~ rest` (foes-fights.js blockingFoes): the strongest, picked for the roller, would keep any leftover current.
    const against = group && !missed && labelOf(line, 'against') ? standing(slice, record.clock).find(([, one]) => one === group)?.[0] : null;
    // The threat that starts the difficulty is that, else this reply's earlier one; one named nowhere leaves the narrator's word. For practice the latest earlier reply's counts too.
    const named = ruled ?? record.threat ?? null;
    const drained = stageOf(poolWith(member, 'sp', cap).now, poolWith(member, 'sp', cap).max, 'energy').index >= 3;
    const physical = PHYSICAL.includes(found.stat);
    const own = floorIndex({ conditions: liveConditions(member, ctx.time?.() ?? null).length, drained, physical });
    const floor = Math.max(record.floor, own);
    // The start is the threat's own step (else the word), the edge moves it at most two steps. Under a threat each live condition (and a drained body on a physical roll) adds a step on top;
    // the floor holds it up either way; then the tone moves it: the dice note lists exactly these numbers (dice/note.js).
    const edge = readEdge(labelOf(line, 'edge'));
    const start = clamp((named ?? difficultyIndex(word)) - (edge?.steps ?? 0), 0, LAST);
    const held = liveConditions(member, ctx.time?.() ?? null).length + (drained && physical ? 1 : 0);
    const { index: floored } = raiseToFloor(clamp(start + (named !== null ? held : 0), 0, LAST), floor);
    const raised = floored > start;
    const index = clamp(floored + toneStep(ctx), 0, LAST);
    // Practice is judged at the difficulty the roll would have had with no edge in the roller's favour: good tactics never cost learning.
    const bare = raiseToFloor(clamp(clamp(named ?? difficultyIndex(word), 0, LAST) + (named !== null ? held : 0), 0, LAST), floor).index;
    const learnAt = Math.max(index, clamp(bare + toneStep(ctx), 0, LAST));
    // (what raised it: the reader's own conditions, else the floor the reply was offered with)
    const why = floorWhy(member, { now: ctx.time?.() ?? null, drained, physical });
    const reasons = raised ? (own >= record.floor && why.length ? why : ['the scene allows nothing easier']) : [];
    const heard = ruled ?? threatHeard(slice, ctx.reply?.sid, record);
    const die = record.list[record.used ?? 0];
    const result = verdict({ die, bonus: found.bonus, dc: DIFFICULTIES[index].dc });

    // A wound only when the story shows the roller struck (`hit:`); the band, not the narrator, sets how bad (owner, 25 Nov: only a direct hit wounds).
    const hit = labelOf(line, 'hit').replace(/\s+/g, ' ').trim().slice(0, 80);
    const stages = hit ? harmFor(result.band, true) : 0;
    let paid = 'none';
    if (!member.companion) {
        paid = stages > 0 ? 'wound' : 'none';
        // The stored wounds is a counter: add the change, never write back a value computed from the clamped read.
        member.wounds += woundsAfter(member, stages) - woundsOf(member);
        // Success at a cost always costs: a hit's wound stage above; with no hit the skill's cost again, else a step of stamina.
        if (result.band === 'cost' && !stages) {
            if (found.skill?.cost && !spendCost(member, found.skill, cap)) paid = 'skill';
            else {
                const sp = poolWith(member, 'sp', cap);
                member.pools.sp.now = Math.max(0, sp.now - Math.ceil(sp.max / 4));
                paid = 'stamina';
            }
        }
    }
    let rankUp = null;
    let practice = 0;
    if (found.skill) ({ gained: practice, rankUp } = addPractice(slice, ctx.reply?.sid, member, found.skill, 'try', rollPractice(result.band, learnAt, heard)));
    if (found.skill) noteRolled(slice, member, found.skill);
    record.used = (record.used ?? 0) + 1;
    record.hardest = Math.max(record.hardest ?? 0, index);
    if (ruled !== null) record.threat = Math.max(record.threat ?? 0, ruled);
    if (result.band === 'great' || result.band === 'success' || result.band === 'cost') record.won = true;
    const ignored = ruled !== null && isDifficultyWord(word) && difficultyIndex(word) !== ruled ? '; difficulty word ignored: foes stand' : '';
    const missing = missed ? `; no foes called ${labelOf(line, 'against').slice(0, 40)} stand, the strongest used` : '';
    const note = ignored + missing + (edge ? (edge.ignored ? '; edge ignored: no reason given' : `; edge ${edge.steps > 0 ? '+' : '−'}${Math.abs(edge.steps)} (${edge.why})`) : '');
    const tail = `${DIFFICULTIES[index].word}${raised ? ` (raised: ${reasons.join(', ')})` : ''}: ${BAND_WORD[result.band]}${result.quality ? ` (${result.quality})` : ''}${note}${rankUp ? `; ${found.skill.name} reaches ${rankUp}` : ''}${costPaid ? '; cost already paid' : ''}.`;
    return {
        summary: `${member.name} tries ${found.skill?.name ?? what}, ${tail}`, narrate: true,
        data: { member: member.id, target: what, die, bonus: found.bonus, total: result.total, difficulty: index, band: result.band, ...(result.quality ? { quality: result.quality } : {}), raised, ...(raised ? { why: reasons } : {}), ...(edge ? { edge: edge.steps, ...(edge.ignored ? { edgeIgnored: true } : { edgeWhy: edge.why }) } : {}), ...(found.unlearned ? { unlearned: true } : {}), paid, ...(stages > 0 ? { hit } : {}), practice, rankUp, ...(costPaid ? { costPaid } : {}), ...(against ? { touched: [against] } : {}) },
    };
}
