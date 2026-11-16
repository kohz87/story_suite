// The longest fight the notes are measured on: 4 heroes (a warrior, a skirmisher with an area skill, a healer and a skill-less one) against 6 foes, 4 exchanges, on the v1 engine.
// The result is the record a v1 settle stores (combat envelope), the setup carries the v1 mark: the kind's own `note` tells it.
import { playBoard } from '../../../../modules/rpg/combat/play.js';
import { envelopeOf } from '../../../../modules/rpg/combat/envelope.js';
import { withSkills } from '../../../modules/rpg/combat/derived-skills.helper.js';
import { seeded } from '../../../modules/rpg/combat/dice.helper.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';

const stats = over => ({ str: 10, vit: 12, agi: 10, dex: 10, int: 10, wis: 10, cha: 5, ...over });
const hero = (label, build, over) => withSkills({ id: label, label, build, level: 12, mastery: 3, stats: stats(over) });
const rat = n => ({ id: `1.${n}`, label: `Rat ${n}`, tier: 'standard', level: 8, hp: 30, maxHp: 30, damage: 6, roll: 8 });
const sheet = { party: [hero('Astra', 'Warrior', { str: 20 }), hero('Bram', 'Skirmisher-area', { agi: 18 }), hero('Cyra', 'Healer', { wis: 14 }), hero('Dov', undefined, { agi: 12 })], foes: [1, 2, 3, 4, 5, 6].map(rat) };

export const FIGHT_RESULT = { v: 1, ...envelopeOf(playBoard(sheet, seeded({ seed: 56 }), Array.from({ length: 4 }, () => ({}))), { id: 'fight-1', groups: [1] }) };
export const FIGHT_SETUP = { v1: 1 };
export const fightNote = () => fightKind.note(FIGHT_RESULT, FIGHT_SETUP).join(' | ');
